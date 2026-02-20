-- ============================================================
-- Migration 009: New Features Bundle
-- B2: Schema Compatibility Validation
-- C2: Batched DLQ Recovery (no schema changes needed)
-- C3: Connection Pool Optimization (no schema changes needed)
-- D2: Data Catalog & Data Dictionary (REMOVED)
-- D3: Alerting Rules Engine (REMOVED)
-- D4: Flow Task Versioning & Rollback
-- D5: Real-Time Pipeline Metrics Stream (no schema changes needed)
-- D6: SQL Transform Node (no schema changes needed - uses existing node types)
-- D7: Data Profiling on Preview (no schema changes needed)
-- D8: Incremental Flow Task Execution
-- E2: Integration Test Suite (no schema changes needed)
-- ============================================================


-- ============================================================
-- D4: Flow Task Versioning & Rollback
-- ============================================================

CREATE TABLE IF NOT EXISTS flow_task_graph_version (
    id SERIAL PRIMARY KEY,
    flow_task_id INTEGER NOT NULL REFERENCES flow_tasks(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    nodes_json JSONB NOT NULL DEFAULT '[]',
    edges_json JSONB NOT NULL DEFAULT '[]',
    change_summary TEXT NULL,           -- auto-generated or user-provided description
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flow_task_graph_version_flow_task_id ON flow_task_graph_version(flow_task_id);
CREATE INDEX IF NOT EXISTS idx_flow_task_graph_version_version ON flow_task_graph_version(flow_task_id, version DESC);
ALTER TABLE flow_task_graph_version DROP CONSTRAINT IF EXISTS uq_flow_task_graph_version;
ALTER TABLE flow_task_graph_version ADD CONSTRAINT uq_flow_task_graph_version
    UNIQUE (flow_task_id, version);

COMMENT ON TABLE flow_task_graph_version IS 'Versioned snapshots of flow task graphs for rollback support';


-- ============================================================
-- D8: Incremental Flow Task Execution
-- ============================================================

-- Track watermark state per input node per flow task
CREATE TABLE IF NOT EXISTS flow_task_watermarks (
    id SERIAL PRIMARY KEY,
    flow_task_id INTEGER NOT NULL REFERENCES flow_tasks(id) ON DELETE CASCADE,
    node_id VARCHAR(255) NOT NULL,
    watermark_column VARCHAR(255) NOT NULL,
    last_watermark_value TEXT NULL,       -- serialized as string for any type
    watermark_type VARCHAR(50) DEFAULT 'TIMESTAMP', -- TIMESTAMP, INTEGER, UUID
    last_run_at TIMESTAMPTZ NULL,
    record_count BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE flow_task_watermarks DROP CONSTRAINT IF EXISTS uq_flow_task_watermark;
ALTER TABLE flow_task_watermarks ADD CONSTRAINT uq_flow_task_watermark
    UNIQUE (flow_task_id, node_id);

CREATE INDEX IF NOT EXISTS idx_flow_task_watermarks_flow_task_id ON flow_task_watermarks(flow_task_id);

COMMENT ON TABLE flow_task_watermarks IS 'Watermark tracking for incremental flow task execution';


-- ============================================================
-- B2: Schema Compatibility Validation — setting for auto-check
-- ============================================================

INSERT INTO rosetta_setting_configuration(config_key, config_value)
VALUES('SCHEMA_COMPATIBILITY_CHECK_ENABLED', 'TRUE')
ON CONFLICT(config_key) DO NOTHING;
