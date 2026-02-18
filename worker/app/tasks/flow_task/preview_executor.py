"""
Flow Task preview executor — runs a partial graph up to a target node and
returns the first N rows (default 500) as a JSON-serializable dict.

Used by the NodePreviewRequest endpoint for live "peek at data during
flow building" without saving the graph.
"""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional

import duckdb
import structlog

from app.tasks.flow_task.compiler import GraphCompiler
from app.tasks.flow_task.connection_factory import SourceConnectionFactory
from app.tasks.flow_task.executor import (
    _setup_duckdb_connection,
    _inject_attach_configs,
    _load_optional_extension,
)

logger = structlog.get_logger(__name__)


def execute_node_preview(
    flow_task_id: int,
    node_id: str,
    graph_snapshot: dict,
    limit: int = 500,
) -> dict:
    """
    Preview the output of a single node without executing the full graph.

    Steps:
    1. Compile the graph snapshot.
    2. Identify the CTE for the target node.
    3. Attach only the upstream input sources needed.
    4. Build the preview SQL: full CTE prefix up to target, then SELECT * LIMIT.
    5. Execute and return rows + metadata.

    Returns:
        {
            "columns": ["col1", "col2", ...],
            "column_types": {"col1": "VARCHAR", ...},
            "rows": [[val, val, ...], ...],
            "row_count": int,
            "elapsed_ms": int,
        }
    """
    start_time = time.time()
    conn: Optional[duckdb.DuckDBPyConnection] = None

    try:
        conn = _setup_duckdb_connection()

        nodes = graph_snapshot.get("nodes", [])
        edges = graph_snapshot.get("edges", [])

        # Inject ATTACH config into input nodes
        _inject_attach_configs(nodes, conn)

        # Compile the (potentially partial) graph
        compiler = GraphCompiler({"nodes": nodes, "edges": edges}).compile()

        # Resolve target CTE
        target_cte = compiler.cte_map.get(node_id)
        if not target_cte:
            raise ValueError(
                f"Node '{node_id}' not found in compiled graph or has no CTE. "
                f"Available CTEs: {list(compiler.cte_map.keys())}"
            )

        # Build SQL up to (and including) the target CTE
        partial_prefix = compiler.get_cte_sql_up_to(target_cte)
        if not partial_prefix:
            raise ValueError(f"Could not build SQL up to CTE '{target_cte}'")

        preview_sql = f"{partial_prefix}\nSELECT * FROM {target_cte} LIMIT {limit}"
        logger.debug(f"Preview SQL for node {node_id}:\n{preview_sql}")

        # Execute
        rel = conn.execute(preview_sql)

        # Collect column metadata
        description = rel.description  # list of (name, type_code, ...)
        if not description:
            return {
                "columns": [],
                "column_types": {},
                "rows": [],
                "row_count": 0,
                "elapsed_ms": int((time.time() - start_time) * 1000),
            }

        columns = [col[0] for col in description]
        raw_rows = rel.fetchall()

        # Serialize rows (handle non-JSON-serializable types)
        serialized_rows = [_serialize_row(row) for row in raw_rows]

        # Map DuckDB type codes to human-readable strings
        column_types = _extract_column_types(description)

        elapsed = int((time.time() - start_time) * 1000)
        logger.info(
            "Node preview complete",
            flow_task_id=flow_task_id,
            node_id=node_id,
            row_count=len(serialized_rows),
            elapsed_ms=elapsed,
        )

        return {
            "columns": columns,
            "column_types": column_types,
            "rows": serialized_rows,
            "row_count": len(serialized_rows),
            "elapsed_ms": elapsed,
        }

    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass


def _serialize_row(row: tuple) -> List[Any]:
    """Convert a tuple row to a JSON-serializable list."""
    result = []
    for val in row:
        if val is None:
            result.append(None)
        elif isinstance(val, (int, float, bool, str)):
            result.append(val)
        else:
            # Dates, Decimals, bytes, etc. → stringify
            result.append(str(val))
    return result


def _extract_column_types(description: list) -> Dict[str, str]:
    """
    Build a {column_name: type_name} dict from cursor description.

    DuckDB cursor description items: (name, type_code, display_size,
    internal_size, precision, scale, null_ok)
    type_code is a duckdb.typing object whose __str__ gives a readable name.
    """
    types: Dict[str, str] = {}
    for col in description:
        name = col[0]
        try:
            types[name] = str(col[1])
        except Exception:
            types[name] = "UNKNOWN"
    return types
