"""
Concurrency controls for resource-intensive operations.

Limits concurrent DuckDB instances to prevent resource exhaustion.
With --pool=threads, each DuckDB connection uses duckdb_threads threads
and duckdb_memory_limit memory. Without a cap, 8 concurrent connections
could consume 32 threads and 16GB memory simultaneously.

IMPORTANT: Linked-task orchestration threads must NOT hold DuckDB slots
while waiting for child flow-task Celery results — doing so causes deadlock
when all slots are consumed by waiting parents and children can't acquire.
"""

import resource
import sys
import threading
from contextlib import contextmanager
from typing import Generator

import structlog

logger = structlog.get_logger(__name__)

_duckdb_semaphore: threading.Semaphore | None = None
_init_lock = threading.Lock()

# Track concurrency metrics for monitoring
_total_acquired = 0
_total_released = 0
_total_waited = 0
_metrics_lock = threading.Lock()


def _get_semaphore() -> threading.Semaphore:
    """Lazy-initialize the DuckDB concurrency semaphore."""
    global _duckdb_semaphore
    if _duckdb_semaphore is None:
        with _init_lock:
            if _duckdb_semaphore is None:
                from app.config.settings import get_settings

                settings = get_settings()
                max_concurrent = max(1, settings.duckdb_max_concurrent)
                _duckdb_semaphore = threading.Semaphore(max_concurrent)
                logger.info(
                    "DuckDB concurrency semaphore initialized",
                    max_concurrent=max_concurrent,
                    worker_concurrency=settings.worker_concurrency,
                )
    return _duckdb_semaphore


@contextmanager
def duckdb_slot() -> Generator[None, None, None]:
    """Context manager to acquire a DuckDB execution slot."""
    acquire_duckdb_slot()
    try:
        yield
    finally:
        release_duckdb_slot()


def acquire_duckdb_slot() -> None:
    """Acquire a DuckDB execution slot. Blocks if all slots are in use."""
    global _total_acquired, _total_waited
    sem = _get_semaphore()
    if not sem.acquire(blocking=False):
        with _metrics_lock:
            _total_waited += 1
        logger.debug("DuckDB slot contention — waiting for available slot")
        sem.acquire()  # blocking wait
    with _metrics_lock:
        _total_acquired += 1


def release_duckdb_slot() -> None:
    """Release a previously acquired DuckDB execution slot."""
    global _total_released
    _get_semaphore().release()
    with _metrics_lock:
        _total_released += 1


def get_concurrency_metrics() -> dict:
    """Return concurrency metrics for health/monitoring endpoints."""
    with _metrics_lock:
        return {
            "total_acquired": _total_acquired,
            "total_released": _total_released,
            "total_waited": _total_waited,
            "slots_in_use": _total_acquired - _total_released,
        }


# ─── Memory watchdog ─────────────────────────────────────────────────────────

_MEMORY_WARNING_MB: int | None = None


def _get_memory_warning_mb() -> int:
    """Get memory warning threshold in MB (lazy-initialized)."""
    global _MEMORY_WARNING_MB
    if _MEMORY_WARNING_MB is None:
        from app.config.settings import get_settings
        settings = get_settings()
        _MEMORY_WARNING_MB = settings.memory_warning_mb
    return _MEMORY_WARNING_MB


def check_memory_pressure() -> bool:
    """Check if current process memory usage exceeds warning threshold.

    Returns True if memory is under pressure (above threshold).
    Logs a warning when threshold is crossed.
    """
    try:
        rusage = resource.getrusage(resource.RUSAGE_SELF)
        maxrss_kb = rusage.ru_maxrss
        # macOS reports bytes, Linux reports KB
        if sys.platform == "darwin":
            maxrss_mb = maxrss_kb / (1024 * 1024)
        else:
            maxrss_mb = maxrss_kb / 1024

        threshold = _get_memory_warning_mb()
        if maxrss_mb > threshold:
            logger.warning(
                "Memory pressure detected",
                rss_mb=round(maxrss_mb, 1),
                threshold_mb=threshold,
            )
            return True
        return False
    except Exception:
        return False


def get_memory_usage_mb() -> float:
    """Return current RSS memory usage in MB."""
    try:
        rusage = resource.getrusage(resource.RUSAGE_SELF)
        if sys.platform == "darwin":
            return rusage.ru_maxrss / (1024 * 1024)
        return rusage.ru_maxrss / 1024
    except Exception:
        return 0.0
