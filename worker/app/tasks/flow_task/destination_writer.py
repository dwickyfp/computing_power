"""
Destination writer for Flow Task output nodes.

Abstract base + concrete implementations for writing DuckDB query results
to target destinations. Supports APPEND and UPSERT (MERGE INTO) modes.

Designed for extension: register new writers via DestinationWriterRegistry.
"""

from __future__ import annotations

import time
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

import duckdb
import structlog

logger = structlog.get_logger(__name__)


class BaseDestinationWriter(ABC):
    """Abstract destination writer."""

    @abstractmethod
    def write(
        self,
        conn: duckdb.DuckDBPyConnection,
        source_cte: str,
        cte_prefix: str,
        target_table: str,
        schema_name: str,
        write_mode: str,
        upsert_keys: List[str],
        output_alias: str,
    ) -> int:
        """
        Write data from the CTE to the destination table.

        Args:
            conn: Active DuckDB connection (with destination already ATTACHed)
            source_cte: Name of the CTE containing data to write
            cte_prefix: The full WITH ... block to prepend to queries
            target_table: Target table name
            schema_name: Target schema name
            write_mode: APPEND or UPSERT
            upsert_keys: Columns to use as merge keys (UPSERT mode)
            output_alias: The DuckDB alias for the destination connection

        Returns:
            Number of rows written
        """
        ...

    @abstractmethod
    def get_row_count(
        self,
        conn: duckdb.DuckDBPyConnection,
        cte_prefix: str,
        source_cte: str,
    ) -> int:
        """Count rows in the source CTE before writing."""
        ...


class PostgresDestinationWriter(BaseDestinationWriter):
    """
    Write to a PostgreSQL destination via DuckDB postgres extension.

    The destination must already be ATTACHed in the DuckDB connection
    under `output_alias`.
    """

    def get_row_count(
        self,
        conn: duckdb.DuckDBPyConnection,
        cte_prefix: str,
        source_cte: str,
    ) -> int:
        count_sql = f"{cte_prefix}\nSELECT COUNT(*) FROM {source_cte}"
        result = conn.execute(count_sql).fetchone()
        return result[0] if result else 0

    def write(
        self,
        conn: duckdb.DuckDBPyConnection,
        source_cte: str,
        cte_prefix: str,
        target_table: str,
        schema_name: str,
        write_mode: str,
        upsert_keys: List[str],
        output_alias: str,
    ) -> int:
        fqt = f"{output_alias}.{schema_name}.{target_table}"
        row_count = self.get_row_count(conn, cte_prefix, source_cte)

        if not target_table:
            raise ValueError(
                "Output node has no target table name configured. "
                "Please set the 'Target Table' field and save the graph before running."
            )

        if write_mode == "UPSERT":
            if not upsert_keys:
                raise ValueError(
                    f"UPSERT mode requires at least one upsert_key for table {target_table}"
                )
            rows_written = self._upsert(
                conn, cte_prefix, source_cte, fqt, upsert_keys
            )
        elif write_mode == "REPLACE":
            # REPLACE mode: truncate + insert
            logger.info("Truncating table", table=fqt)
            conn.execute(f"TRUNCATE TABLE {fqt}")
            rows_written = self._append(conn, cte_prefix, source_cte, fqt)
        else:
            # APPEND mode
            rows_written = self._append(conn, cte_prefix, source_cte, fqt)

        logger.info(
            "Destination write complete",
            target_table=target_table,
            schema=schema_name,
            write_mode=write_mode,
            rows_written=rows_written,
        )
        return rows_written

    def _append(
        self,
        conn: duckdb.DuckDBPyConnection,
        cte_prefix: str,
        source_cte: str,
        fqt: str,
    ) -> int:
        """INSERT INTO ... SELECT * FROM cte."""
        # Get columns
        cols_result = conn.execute(
            f"{cte_prefix}\nSELECT * FROM {source_cte} LIMIT 0"
        ).description
        cols = [d[0] for d in cols_result] if cols_result else []

        if not cols:
            logger.warning("No columns found in source CTE — skipping append")
            return 0

        col_list = ", ".join(cols)
        insert_sql = (
            f"{cte_prefix}\n"
            f"INSERT INTO {fqt} ({col_list})\n"
            f"SELECT {col_list} FROM {source_cte}"
        )
        conn.execute(insert_sql)

        # DuckDB postgres extension doesn't return row count from INSERT;
        # we already captured it above
        return self.get_row_count(conn, cte_prefix, source_cte)

    def _upsert(
        self,
        conn: duckdb.DuckDBPyConnection,
        cte_prefix: str,
        source_cte: str,
        fqt: str,
        upsert_keys: List[str],
    ) -> int:
        """
        MERGE INTO target USING source ON key_conditions
        WHEN MATCHED THEN UPDATE ...
        WHEN NOT MATCHED THEN INSERT ...

        DuckDB supports MERGE INTO syntax natively.
        """
        # Get columns
        cols_result = conn.execute(
            f"{cte_prefix}\nSELECT * FROM {source_cte} LIMIT 0"
        ).description
        cols = [d[0] for d in cols_result] if cols_result else []

        if not cols:
            logger.warning("No columns found in source CTE — skipping upsert")
            return 0

        # Build ON clause
        on_clause = " AND ".join(
            f"tgt.{k} = src.{k}" for k in upsert_keys
        )

        # UPDATE SET clause — exclude key columns
        non_key_cols = [c for c in cols if c not in upsert_keys]
        update_expr = ",\n    ".join(f"{c} = src.{c}" for c in non_key_cols)

        # INSERT clause
        col_list = ", ".join(cols)
        src_col_list = ", ".join(f"src.{c}" for c in cols)

        merge_sql = (
            f"{cte_prefix},\n"
            f"__src AS (SELECT * FROM {source_cte})\n"
            f"MERGE INTO {fqt} AS tgt\n"
            f"USING __src AS src\n"
            f"ON ({on_clause})\n"
            f"WHEN MATCHED THEN\n"
            f"  UPDATE SET\n    {update_expr}\n"
            f"WHEN NOT MATCHED THEN\n"
            f"  INSERT ({col_list})\n"
            f"  VALUES ({src_col_list})"
        )

        conn.execute(merge_sql)
        return self.get_row_count(conn, cte_prefix, source_cte)


# ─── Registry ─────────────────────────────────────────────────────────────────

class DestinationWriterRegistry:
    """Maps destination type strings to writer implementations."""

    _registry: Dict[str, type] = {
        "POSTGRES": PostgresDestinationWriter,
        "POSTGRESQL": PostgresDestinationWriter,
        # Future: "SNOWFLAKE": SnowflakeDestinationWriter,
    }

    @classmethod
    def get_writer(cls, dest_type: str) -> BaseDestinationWriter:
        writer_cls = cls._registry.get(dest_type.upper())
        if not writer_cls:
            raise ValueError(
                f"No writer registered for destination type '{dest_type}'. "
                f"Available: {list(cls._registry.keys())}"
            )
        return writer_cls()

    @classmethod
    def register(cls, dest_type: str, writer_class: type) -> None:
        """Register a new destination writer (e.g., Snowflake, BigQuery)."""
        cls._registry[dest_type.upper()] = writer_class
