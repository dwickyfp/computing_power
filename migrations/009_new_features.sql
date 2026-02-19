-- ============================================================
-- Migration 009: New Features Bundle
-- B2: Schema Compatibility Validation
-- C2: Batched DLQ Recovery (no schema changes needed)
-- C3: Connection Pool Optimization (no schema changes needed)
-- D2: Data Catalog & Data Dictionary
-- D3: Alerting Rules Engine
-- D4: Flow Task Versioning & Rollback
-- D5: Real-Time Pipeline Metrics Stream (no schema changes needed)
-- D6: SQL Transform Node (no schema changes needed - uses existing node types)
-- D7: Data Profiling on Preview (no schema changes needed)
-- D8: Incremental Flow Task Execution
-- E2: Integration Test Suite (no schema changes needed)
-- ============================================================


-- ============================================================
-- D2: Data Catalog & Data Dictionary
-- ============================================================

-- Table-level catalog entries
CREATE TABLE IF NOT EXISTS data_catalog (
    id SERIAL PRIMARY KEY,
    source_id INTEGER NULL REFERENCES sources(id) ON DELETE SET NULL,
    destination_id INTEGER NULL REFERENCES destinations(id) ON DELETE SET NULL,
    table_name VARCHAR(255) NOT NULL,
    schema_name VARCHAR(255) DEFAULT 'public',
    description TEXT NULL,
    owner VARCHAR(255) NULL,
    classification VARCHAR(50) DEFAULT 'INTERNAL',  -- INTERNAL, CONFIDENTIAL, PUBLIC, RESTRICTED
    sla_freshness_minutes INTEGER NULL,              -- max acceptable data age
    tags TEXT[] DEFAULT '{}',
    custom_properties JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_catalog_source_id ON data_catalog(source_id);
CREATE INDEX IF NOT EXISTS idx_data_catalog_destination_id ON data_catalog(destination_id);
CREATE INDEX IF NOT EXISTS idx_data_catalog_table_name ON data_catalog(table_name);
CREATE INDEX IF NOT EXISTS idx_data_catalog_classification ON data_catalog(classification);
ALTER TABLE data_catalog DROP CONSTRAINT IF EXISTS uq_data_catalog_entry;
ALTER TABLE data_catalog ADD CONSTRAINT uq_data_catalog_entry
    UNIQUE (source_id, destination_id, schema_name, table_name);

COMMENT ON TABLE data_catalog IS 'Table-level data catalog for documenting data assets';

-- Column-level dictionary entries
CREATE TABLE IF NOT EXISTS data_dictionary (
    id SERIAL PRIMARY KEY,
    catalog_id INTEGER NOT NULL REFERENCES data_catalog(id) ON DELETE CASCADE,
    column_name VARCHAR(255) NOT NULL,
    data_type VARCHAR(100) NULL,
    description TEXT NULL,
    is_pii BOOLEAN DEFAULT FALSE,
    is_nullable BOOLEAN DEFAULT TRUE,
    sample_values TEXT NULL,
    business_rule TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_dictionary_catalog_id ON data_dictionary(catalog_id);
ALTER TABLE data_dictionary DROP CONSTRAINT IF EXISTS uq_data_dictionary_column;
ALTER TABLE data_dictionary ADD CONSTRAINT uq_data_dictionary_column
    UNIQUE (catalog_id, column_name);

COMMENT ON TABLE data_dictionary IS 'Column-level data dictionary with PII flags and business rules';


-- ============================================================
-- D3: Alerting Rules Engine
-- ============================================================

CREATE TABLE IF NOT EXISTS alert_rules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT NULL,
    metric_type VARCHAR(50) NOT NULL,     -- REPLICATION_LAG, WAL_SIZE, PIPELINE_ERROR, CPU_USAGE, MEMORY_USAGE, CUSTOM_QUERY
    condition_operator VARCHAR(10) NOT NULL, -- GT, GTE, LT, LTE, EQ, NEQ
    threshold_value FLOAT NOT NULL,
    duration_seconds INTEGER DEFAULT 0,    -- condition must persist for N seconds
    source_id INTEGER NULL REFERENCES sources(id) ON DELETE CASCADE,
    destination_id INTEGER NULL REFERENCES destinations(id) ON DELETE CASCADE,
    pipeline_id INTEGER NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    notification_channels TEXT[] DEFAULT '{webhook,telegram}',
    cooldown_minutes INTEGER DEFAULT 15,   -- don't re-fire for N minutes
    is_enabled BOOLEAN DEFAULT TRUE,
    last_triggered_at TIMESTAMPTZ NULL,
    last_value FLOAT NULL,
    trigger_count INTEGER DEFAULT 0,
    custom_query TEXT NULL,                -- for CUSTOM_QUERY metric type
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_is_enabled ON alert_rules(is_enabled) WHERE is_enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_alert_rules_metric_type ON alert_rules(metric_type);

COMMENT ON TABLE alert_rules IS 'Configurable alerting rules evaluated periodically by the scheduler';

-- Alert history
CREATE TABLE IF NOT EXISTS alert_history (
    id SERIAL PRIMARY KEY,
    alert_rule_id INTEGER NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    metric_value FLOAT NOT NULL,
    threshold_value FLOAT NOT NULL,
    message TEXT NOT NULL,
    notification_sent BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_history_rule_id ON alert_history(alert_rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_created_at ON alert_history(created_at DESC);

COMMENT ON TABLE alert_history IS 'History of triggered alerts for auditing and dashboards';


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

INSERT INTO rosetta_setting_configuration(config_key, config_value)
VALUES('ALERT_RULES_CHECK_INTERVAL_SECONDS', '30')
ON CONFLICT(config_key) DO NOTHING;
