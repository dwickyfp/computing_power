-- Migration: Add table list tracking to destinations
-- Adds list_tables (JSONB), total_tables (INT), last_table_check_at (TIMESTAMPTZ) to destinations

ALTER TABLE destinations
    ADD COLUMN IF NOT EXISTS list_tables JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS total_tables INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_table_check_at TIMESTAMPTZ NULL;
