"""
Concurrency controls for resource-intensive operations.

Limits concurrent DuckDB instances to prevent resource exhaustion.
With --pool=threads, each DuckDB connection uses duckdb_threads threads
and duckdb_memory_limit memory. Without a cap, 8 concurrent connections
could consume 32 threads and 16GB memory simultaneously.
"""

import threading
from contextlib import contextmanager
from typing import Generator

_duckdb_semaphore: threading.Semaphore | None = None
_init_lock = threading.Lock()


def _get_semaphore() -> threading.Semaphore:
    """Lazy-initialize the DuckDB concurrency semaphore."""
    global _duckdb_semaphore
    if _duckdb_semaphore is None:
        with _init_lock:
            if _duckdb_semaphore is None:
                from app.config.settings import get_settings

                settings = get_settings()
                max_concurrent = max(1, settings.worker_concurrency // 2)
                _duckdb_semaphore = threading.Semaphore(max_concurrent)
    return _duckdb_semaphore


@contextmanager
def duckdb_slot() -> Generator[None, None, None]:
    """Context manager to acquire a DuckDB execution slot."""
    sem = _get_semaphore()
    sem.acquire()
    try:
        yield
    finally:
        sem.release()


def acquire_duckdb_slot() -> None:
    """Acquire a DuckDB execution slot. Blocks if all slots are in use."""
    _get_semaphore().acquire()


def release_duckdb_slot() -> None:
    """Release a previously acquired DuckDB execution slot."""
    _get_semaphore().release()
