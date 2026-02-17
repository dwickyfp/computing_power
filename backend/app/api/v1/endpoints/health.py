"""
Health check endpoints.

Provides application health and status information.
"""

import time
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends

from app import __version__
from app.core.config import get_settings
from app.core.database import check_database_health
from app.domain.schemas.common import HealthResponse

import httpx
import asyncio
from app.core.logging import get_logger

logger = get_logger(__name__)

router = APIRouter()

# Simple cache for health check results (3 second TTL)
_health_cache: Optional[HealthResponse] = None
_health_cache_time: float = 0
_health_cache_ttl: float = 3.0


@router.get(
    "",
    response_model=HealthResponse,
    summary="Health check",
    description="Check application health and dependency status",
)
async def health_check() -> HealthResponse:
    """
    Check application health.

    Returns health status including database connectivity.
    All checks run in parallel with 1-second timeout for faster response.
    Uses 3-second cache to avoid excessive health checks.
    """
    global _health_cache, _health_cache_time
    
    # Return cached result if fresh
    now = time.time()
    if _health_cache and (now - _health_cache_time) < _health_cache_ttl:
        return _health_cache
    
    settings = get_settings()

    async def check_db() -> bool:
        try:
            return await asyncio.wait_for(
                asyncio.to_thread(check_database_health),
                timeout=1.0
            )
        except Exception as e:
            logger.warning(f"DB health check failed: {e}")
            return False

    async def check_redis() -> bool:
        try:
            from app.infrastructure.redis import RedisClient
            redis_client = RedisClient.get_instance()
            check = redis_client.ping()
            if asyncio.iscoroutinefunction(redis_client.ping):
                return await asyncio.wait_for(check, timeout=1.0)
            return check
        except Exception as e:
            logger.warning(f"Redis health check failed: {e}")
            return False

    async def check_compute() -> bool:
        try:
            url = f"{settings.compute_node_url}/health"
            async with httpx.AsyncClient(timeout=1.0) as client:
                response = await client.get(url)
                return response.status_code == 200 and response.json().get("status") == "healthy"
        except Exception as e:
            logger.debug(f"Compute health check failed: {e}")
            return False

    async def check_worker() -> tuple[bool, dict]:
        if not settings.worker_enabled:
            return False, {}
        try:
            from app.infrastructure.worker_client import get_worker_client
            client = get_worker_client()
            status = await asyncio.wait_for(
                asyncio.to_thread(client.get_worker_health),
                timeout=3.0  # Increased for 3 inspector calls (ping, active, reserved)
            )
            return status.get("healthy", False), status
        except asyncio.TimeoutError:
            logger.warning(f"Worker health check timed out")
            return False, {}
        except Exception as e:
            logger.warning(f"Worker health check failed: {e}")
            return False, {}

    # Run all checks in parallel
    db_healthy, redis_healthy, compute_healthy, (worker_healthy, worker_stats) = await asyncio.gather(
        check_db(),
        check_redis(),
        check_compute(),
        check_worker(),
        return_exceptions=False
    )

    # Determine overall status
    # We consider healthy if DB and Redis are up. Compute is optional for API but tracked.
    overall_status = "healthy" if db_healthy and redis_healthy else "unhealthy"

    result = HealthResponse(
        status=overall_status,
        version=__version__,
        timestamp=datetime.now(timezone(timedelta(hours=7))),
        checks={
            "database": db_healthy, 
            "redis": redis_healthy,
            "wal_monitor": settings.wal_monitor_enabled,
            "compute": compute_healthy,
            "worker": worker_healthy,
        },
    )
    
    # Cache the result
    _health_cache = result
    _health_cache_time = now
    return result


@router.get(
    "/worker",
    summary="Worker status",
    description="Get detailed Celery worker health and statistics",
)
async def worker_status() -> Dict[str, Any]:
    """
    Get detailed worker status including active workers,
    running tasks, and queue info.

    Returns disabled status if WORKER_ENABLED is false.
    """
    settings = get_settings()

    if not settings.worker_enabled:
        return {
            "enabled": False,
            "healthy": False,
            "active_workers": 0,
            "active_tasks": 0,
            "reserved_tasks": 0,
        }

    try:
        from app.infrastructure.worker_client import get_worker_client

        client = get_worker_client()
        health = await asyncio.to_thread(client.get_worker_health)
        return {"enabled": True, **health}
    except Exception as e:
        logger.warning(f"Worker status check failed: {e}")
        return {
            "enabled": True,
            "healthy": False,
            "active_workers": 0,
            "active_tasks": 0,
            "reserved_tasks": 0,
            "error": str(e),
        }
