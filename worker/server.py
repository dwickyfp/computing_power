"""
FastAPI Server for Rosetta Worker Health API.

Provides health check endpoint for monitoring.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import time

import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from celery import Celery

from app.config.settings import settings

logger = logging.getLogger(__name__)

app = FastAPI(title="Rosetta Worker Health API")

# Cache results for 3 seconds to avoid repeated expensive inspect calls
_health_cache: Optional[dict] = None
_health_cache_time: float = 0
_cache_ttl: float = 3.0

# Reuse Celery app instance instead of creating new one each time
_celery_app: Optional[Celery] = None


def get_celery_app() -> Celery:
    """Get or create reusable Celery app instance for health checks."""
    global _celery_app
    if _celery_app is None:
        _celery_app = Celery(
            "health_checker",
            broker=settings.celery_broker_url,
            backend=settings.celery_result_backend,
        )
    return _celery_app


@app.get("/health")
async def health_check():
    """
    Health check endpoint.

    Checks if the Celery worker is responding by inspecting active workers.
    Results are cached for 3 seconds to improve response time.
    """
    global _health_cache, _health_cache_time

    # Return cached result if fresh
    now = time.time()
    if _health_cache and (now - _health_cache_time) < _cache_ttl:
        return _health_cache

    try:
        # Use reusable Celery app connection
        celery_app = get_celery_app()

        # Ping with 3-second timeout (increased from 1s for reliability)
        inspector = celery_app.control.inspect(timeout=3.0)
        ping_result = inspector.ping()

        if not ping_result:
            result = {
                "status": "unhealthy",
                "healthy": False,
                "active_workers": 0,
                "active_tasks": 0,
                "reserved_tasks": 0,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "error": "No workers responding",
            }
            return result

        active_workers = len(ping_result)

        # Count active and reserved tasks
        active_tasks = 0
        active = inspector.active()
        if active:
            for worker_tasks in active.values():
                active_tasks += len(worker_tasks)

        reserved_tasks = 0
        reserved = inspector.reserved()
        if reserved:
            for worker_tasks in reserved.values():
                reserved_tasks += len(worker_tasks)

        result = {
            "status": "healthy",
            "healthy": True,
            "active_workers": active_workers,
            "active_tasks": active_tasks,
            "reserved_tasks": reserved_tasks,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        # Cache the successful result
        _health_cache = result
        _health_cache_time = now
        return result

    except Exception as e:
        logger.error(f"Health check failed: {e}")
        result = {
            "status": "unhealthy",
            "healthy": False,
            "active_workers": 0,
            "active_tasks": 0,
            "reserved_tasks": 0,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "error": str(e),
        }
        # Don't cache errors
        return result


def run_server() -> None:
    """
    Run FastAPI server using Uvicorn.
    """
    try:
        uvicorn.run(
            app, host=settings.server_host, port=settings.server_port, log_level="info"
        )
    except Exception as e:
        logger.error(f"Failed to start health API server: {e}")


# ─── Schema endpoint ──────────────────────────────────────────────────────────

class NodeSchemaRequest(BaseModel):
    node_id: str
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]


class ColumnSchemaItem(BaseModel):
    column_name: str
    data_type: str


class NodeSchemaResponse(BaseModel):
    columns: List[ColumnSchemaItem]


@app.post("/schema", response_model=NodeSchemaResponse)
def get_node_schema(request: NodeSchemaRequest):
    """
    Synchronously execute the DuckDB CTE chain up to the target node with
    LIMIT 0 and return the output column names + types.

    No rows are fetched — only Arrow schema metadata is read, so this is
    fast regardless of upstream table size or transformation complexity.
    """
    try:
        from app.tasks.flow_task.preview_executor import execute_node_schema

        result = execute_node_schema(
            node_id=request.node_id,
            graph_snapshot={"nodes": request.nodes, "edges": request.edges},
        )
        return NodeSchemaResponse(columns=result["columns"])
    except Exception as e:
        # Return empty columns instead of crashing — the UI handles the empty state
        # gracefully. Common causes: source DB not reachable, node not yet configured.
        logger.warning(f"Node schema resolution returned empty (non-fatal): {e}")
        return NodeSchemaResponse(columns=[])


if __name__ == "__main__":
    run_server()
