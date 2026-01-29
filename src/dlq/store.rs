//! DLQ Store - In-memory Dead Letter Queue with fjall metadata persistence
//!
//! Stores events that failed to write to destination due to connection errors.
//! Events are kept in-memory (since Event from etl crate doesn't implement Serialize),
//! while metadata (counts, error states) are persisted to fjall for durability.

use anyhow::{Context, Result};
use etl::types::Event;
use fjall::{Database, Keyspace, KeyspaceCreateOptions, PersistMode};
use std::collections::{HashMap, VecDeque};
use std::path::Path;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, info};

/// Entry in the DLQ
#[allow(dead_code)]
struct DlqEntry {
    events: Vec<Event>,
    timestamp: chrono::DateTime<chrono::Utc>,
}

/// Dead Letter Queue store using in-memory queue with fjall metadata persistence
pub struct DlqStore {
    /// In-memory queues per destination/table: (dest_id, table) -> queue of event batches
    queues: Arc<RwLock<HashMap<(i32, String), VecDeque<DlqEntry>>>>,
    /// Fjall DB for metadata persistence (counts, last error times, etc)
    db: Arc<Database>,
    /// Metadata keyspace
    metadata_ks: Keyspace,
}

impl Clone for DlqStore {
    fn clone(&self) -> Self {
        Self {
            queues: self.queues.clone(),
            db: self.db.clone(),
            metadata_ks: self.metadata_ks.clone(),
        }
    }
}

impl DlqStore {
    /// Create a new DLQ store at the specified path
    pub fn new(base_path: &Path) -> Result<Self> {
        let dlq_path = base_path.join("dlq");
        std::fs::create_dir_all(&dlq_path)
            .context("Failed to create DLQ directory")?;

        let db = Database::builder(&dlq_path)
            .open()
            .context("Failed to open DLQ database")?;

        let db = Arc::new(db);

        // Create metadata keyspace
        let metadata_ks = db
            .keyspace("dlq_metadata", || KeyspaceCreateOptions::default())
            .context("Failed to create metadata keyspace")?;

        info!("DLQ store initialized at {:?}", dlq_path);

        Ok(Self {
            queues: Arc::new(RwLock::new(HashMap::new())),
            db,
            metadata_ks,
        })
    }

    /// Generate key for a destination/table combination
    fn make_key(pipeline_dest_id: i32, table_name: &str) -> (i32, String) {
        (pipeline_dest_id, table_name.to_string())
    }

    /// Push events to the DLQ for a specific destination and table
    pub async fn push(&self, pipeline_dest_id: i32, table_name: &str, events: Vec<Event>) -> Result<()> {
        if events.is_empty() {
            return Ok(());
        }

        let key = Self::make_key(pipeline_dest_id, table_name);
        let entry = DlqEntry {
            events,
            timestamp: chrono::Utc::now(),
        };

        let mut queues = self.queues.write().await;
        queues.entry(key.clone()).or_insert_with(VecDeque::new).push_back(entry);

        // Update metadata (count)
        let count = queues.get(&key).map(|q| q.len()).unwrap_or(0);
        self.update_count_metadata(pipeline_dest_id, table_name, count)?;

        debug!(
            "DLQ: Pushed events for dest {} table {}, queue size: {}",
            pipeline_dest_id,
            table_name,
            count
        );

        Ok(())
    }

    /// Pop a batch of events from the DLQ (oldest first)
    /// Returns events and removes them from the store
    pub async fn pop_batch(&self, pipeline_dest_id: i32, table_name: &str, limit: usize) -> Result<Vec<Event>> {
        let key = Self::make_key(pipeline_dest_id, table_name);
        let mut queues = self.queues.write().await;

        let mut all_events = Vec::new();
        
        if let Some(queue) = queues.get_mut(&key) {
            let mut batches_to_take = limit;
            while batches_to_take > 0 && !queue.is_empty() {
                if let Some(entry) = queue.pop_front() {
                    all_events.extend(entry.events);
                    batches_to_take -= 1;
                }
            }

            // Update metadata
            let remaining = queue.len();
            self.update_count_metadata(pipeline_dest_id, table_name, remaining)?;

            debug!(
                "DLQ: Popped {} events for dest {} table {}, remaining: {}",
                all_events.len(),
                pipeline_dest_id,
                table_name,
                remaining
            );
        }

        Ok(all_events)
    }

    /// Check if DLQ is empty for a destination/table
    pub async fn is_empty(&self, pipeline_dest_id: i32, table_name: &str) -> bool {
        let key = Self::make_key(pipeline_dest_id, table_name);
        let queues = self.queues.read().await;
        queues.get(&key).map(|q| q.is_empty()).unwrap_or(true)
    }

    /// Count total event batches in DLQ for a destination (across all tables)
    pub async fn count_for_destination(&self, pipeline_dest_id: i32) -> usize {
        let queues = self.queues.read().await;
        queues
            .iter()
            .filter(|((dest_id, _), _)| *dest_id == pipeline_dest_id)
            .map(|(_, queue)| queue.len())
            .sum()
    }

    /// Get all table names with pending DLQ entries for a destination
    pub async fn get_pending_tables(&self, pipeline_dest_id: i32) -> Vec<String> {
        let queues = self.queues.read().await;
        queues
            .iter()
            .filter(|((dest_id, _), queue)| *dest_id == pipeline_dest_id && !queue.is_empty())
            .map(|((_, table), _)| table.clone())
            .collect()
    }

    /// Update count metadata in fjall
    fn update_count_metadata(&self, pipeline_dest_id: i32, table_name: &str, count: usize) -> Result<()> {
        let key = format!("count:{}:{}", pipeline_dest_id, table_name);
        let value = count.to_string();
        
        self.metadata_ks.insert(&key, &value)
            .context("Failed to update DLQ count metadata")?;
        
        // Persist asynchronously (best effort)
        let _ = self.db.persist(PersistMode::Buffer);
        
        Ok(())
    }

    /// Get total event count from metadata
    pub fn get_stored_count(&self, pipeline_dest_id: i32, table_name: &str) -> usize {
        let key = format!("count:{}:{}", pipeline_dest_id, table_name);
        
        match self.metadata_ks.get(&key) {
            Ok(Some(bytes)) => {
                String::from_utf8_lossy(&bytes)
                    .parse()
                    .unwrap_or(0)
            }
            _ => 0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_dlq_store_basic() {
        let dir = tempdir().unwrap();
        let store = DlqStore::new(dir.path()).unwrap();
        
        // Initially empty
        assert!(store.is_empty(1, "test_table").await);
    }
}
