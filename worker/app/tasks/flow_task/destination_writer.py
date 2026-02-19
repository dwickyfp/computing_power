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
        destination_id: Optional[int] = None,
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
        destination_id: Optional[int] = None,
    ) -> int:
        fqt = f"{output_alias}.{schema_name}.{target_table}"
        # Count rows once upfront — reuse for the return value
        row_count = self.get_row_count(conn, cte_prefix, source_cte)

        if not target_table:
            raise ValueError(
                "Output node has no target table name configured. "
                "Please set the 'Target Table' field and save the graph before running."
            )

        if row_count == 0:
            logger.info("Source CTE is empty — skipping write", target_table=target_table)
            return 0

        if write_mode == "UPSERT":
            if not upsert_keys:
                raise ValueError(
                    f"UPSERT mode requires at least one upsert_key for table {target_table}"
                )
            self._upsert(conn, cte_prefix, source_cte, fqt, upsert_keys)
        elif write_mode == "REPLACE":
            # REPLACE mode: truncate + insert
            logger.info("Truncating table", table=fqt)
            conn.execute(f"TRUNCATE TABLE {fqt}")
            self._append(conn, cte_prefix, source_cte, fqt)
        else:
            # APPEND mode
            self._append(conn, cte_prefix, source_cte, fqt)

        logger.info(
            "Destination write complete",
            target_table=target_table,
            schema=schema_name,
            write_mode=write_mode,
            rows_written=row_count,
        )
        return row_count

    def _append(
        self,
        conn: duckdb.DuckDBPyConnection,
        cte_prefix: str,
        source_cte: str,
        fqt: str,
    ) -> None:
        """INSERT INTO ... SELECT * FROM cte."""
        # Get columns
        cols_result = conn.execute(
            f"{cte_prefix}\nSELECT * FROM {source_cte} LIMIT 0"
        ).description
        cols = [d[0] for d in cols_result] if cols_result else []

        if not cols:
            logger.warning("No columns found in source CTE — skipping append")
            return

        col_list = ", ".join(cols)
        insert_sql = (
            f"{cte_prefix}\n"
            f"INSERT INTO {fqt} ({col_list})\n"
            f"SELECT {col_list} FROM {source_cte}"
        )
        conn.execute(insert_sql)

    def _upsert(
        self,
        conn: duckdb.DuckDBPyConnection,
        cte_prefix: str,
        source_cte: str,
        fqt: str,
        upsert_keys: List[str],
    ) -> None:
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
            return

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


# ─── Snowflake Writer ─────────────────────────────────────────────────────────


class SnowflakeDestinationWriter(BaseDestinationWriter):
    """
    Write to a Snowflake destination via snowflake-connector-python.

    DuckDB's Snowflake extension is read-only, so data is fetched from
    the CTE as a pandas DataFrame and written via write_pandas().
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
        destination_id: Optional[int] = None,
    ) -> int:
        import json as _json

        import snowflake.connector
        from cryptography.hazmat.backends import default_backend
        from cryptography.hazmat.primitives import serialization
        from snowflake.connector.pandas_tools import write_pandas

        from app.core.database import get_db_session
        from app.core.security import decrypt_value

        # Fetch data from DuckDB CTE as Arrow table (avoid premature Pandas conversion)
        fetch_sql = f"{cte_prefix}\nSELECT * FROM {source_cte}"
        arrow_table = conn.execute(fetch_sql).fetch_arrow_table()

        if arrow_table.num_rows == 0:
            return 0

        # Convert to pandas only when needed for write_pandas()
        # This defers the costly Arrow→Pandas conversion until the last moment
        df = arrow_table.to_pandas(self_destruct=True)  # self_destruct frees Arrow buffers early
        del arrow_table  # release Arrow memory immediately

        if destination_id is None:
            raise ValueError("SnowflakeDestinationWriter requires destination_id")

        # Fetch destination config
        with get_db_session() as db:
            from sqlalchemy import text

            row = db.execute(
                text("SELECT config FROM destinations WHERE id = :id"),
                {"id": destination_id},
            ).fetchone()

        if not row:
            raise ValueError(f"Destination {destination_id} not found")

        config = row.config if isinstance(row.config, dict) else _json.loads(row.config)

        # Build Snowflake connection
        conn_params: dict = {
            "user": config.get("user"),
            "account": config.get("account"),
            "role": config.get("role"),
            "warehouse": config.get("warehouse"),
            "database": config.get("database"),
            "schema": schema_name or config.get("schema"),
            "application": "Rosetta_ETL",
        }

        if config.get("private_key"):
            pk_str = config["private_key"].strip().replace("\\n", "\n")
            if not pk_str.startswith("-----"):
                try:
                    pk_str = decrypt_value(pk_str)
                except Exception:
                    pass
            passphrase = None
            if config.get("private_key_passphrase"):
                pp = config["private_key_passphrase"]
                try:
                    pp = decrypt_value(pp)
                except Exception:
                    pass
                passphrase = pp.encode()
            p_key = serialization.load_pem_private_key(
                pk_str.encode(), password=passphrase, backend=default_backend()
            )
            conn_params["private_key"] = p_key.private_bytes(
                encoding=serialization.Encoding.DER,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption(),
            )
        elif config.get("password"):
            try:
                conn_params["password"] = decrypt_value(config["password"])
            except Exception:
                conn_params["password"] = config["password"]

        sf_conn = snowflake.connector.connect(**conn_params)
        try:
            if write_mode == "REPLACE":
                cursor = sf_conn.cursor()
                cursor.execute(
                    f"TRUNCATE TABLE IF EXISTS {schema_name}.{target_table}"
                )
                cursor.close()

            if write_mode == "UPSERT":
                rows_written = self._upsert_snowflake(
                    sf_conn, df, target_table, schema_name, upsert_keys
                )
            else:
                # APPEND or REPLACE (after truncate)
                _success, _num_chunks, num_rows, _ = write_pandas(
                    sf_conn,
                    df,
                    target_table,
                    schema=schema_name,
                    auto_create_table=False,
                )
                rows_written = num_rows

            logger.info(
                "Snowflake write complete",
                target_table=target_table,
                schema=schema_name,
                write_mode=write_mode,
                rows_written=rows_written,
            )
            return rows_written
        finally:
            sf_conn.close()

    def _upsert_snowflake(
        self,
        sf_conn: Any,
        df: Any,
        target_table: str,
        schema_name: str,
        upsert_keys: List[str],
    ) -> int:
        """Snowflake MERGE INTO via temporary staging table."""
        import random
        import string

        from snowflake.connector.pandas_tools import write_pandas

        stage_table = f"__tmp_{''.join(random.choices(string.ascii_lowercase, k=8))}"
        cursor = sf_conn.cursor()
        try:
            cursor.execute(
                f"CREATE TEMPORARY TABLE {schema_name}.{stage_table} "
                f"LIKE {schema_name}.{target_table}"
            )
            write_pandas(sf_conn, df, stage_table, schema=schema_name)

            cols = list(df.columns)
            on_clause = " AND ".join(f"tgt.{k} = src.{k}" for k in upsert_keys)
            non_key_cols = [c for c in cols if c not in upsert_keys]
            update_expr = ", ".join(f"tgt.{c} = src.{c}" for c in non_key_cols)
            col_list = ", ".join(cols)
            src_col_list = ", ".join(f"src.{c}" for c in cols)

            merge_sql = (
                f"MERGE INTO {schema_name}.{target_table} AS tgt "
                f"USING {schema_name}.{stage_table} AS src "
                f"ON ({on_clause}) "
            )
            if non_key_cols:
                merge_sql += f"WHEN MATCHED THEN UPDATE SET {update_expr} "
            merge_sql += (
                f"WHEN NOT MATCHED THEN INSERT ({col_list}) "
                f"VALUES ({src_col_list})"
            )

            cursor.execute(merge_sql)
            return len(df)
        finally:
            try:
                cursor.execute(
                    f"DROP TABLE IF EXISTS {schema_name}.{stage_table}"
                )
            except Exception:
                pass
            cursor.close()


# ─── Registry ─────────────────────────────────────────────────────────────────

class DestinationWriterRegistry:
    """Maps destination type strings to writer implementations."""

    _registry: Dict[str, type] = {
        "POSTGRES": PostgresDestinationWriter,
        "POSTGRESQL": PostgresDestinationWriter,
        "SNOWFLAKE": SnowflakeDestinationWriter,
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
