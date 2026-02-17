"""
FastAPI Server for Rosetta Worker Health API.

Provides health check endpoint for monitoring.
"""

import logging
from datetime import datetime, timezone
from typing import Optional
import time

import uvicorn
from fastapi import FastAPI
from celery import Celery

from app.config.settings import settings

logger = logging.getLogger(__name__)

app = FastAPI(title="Rosetta Worker Health API")

# Cache results for 3 seconds to avoid repeated expensive inspect calls
_health_cache: Optional[dict] = None
_health_cache_time: float = 0
_cache_ttl: float = 3.0


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
        # Create temporary Celery app connection
        celery_app = Celery(
            "health_checker",
            broker=settings.celery_broker_url,
            backend=settings.celery_result_backend,
        )
        
        # Quick ping with 1-second timeout
        inspector = celery_app.control.inspect(timeout=1.0)
        ping_result = inspector.ping()
        
        if not ping_result:
            result = {
                "status": "unhealthy",
                "healthy": False,
                "active_workers": 0,
                "active_tasks": 0,
                "reserved_tasks": 0,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "error": "No workers responding"
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
            "error": str(e)
        }
        # Don't cache errors
        return result


def run_server() -> None:
    """
    Run FastAPI server using Uvicorn.
    """
    try:
        uvicorn.run(
            app, 
            host=settings.server_host, 
            port=settings.server_port, 
            log_level="info"
        )
    except Exception as e:
        logger.error(f"Failed to start health API server: {e}")


if __name__ == "__main__":
    run_server()
