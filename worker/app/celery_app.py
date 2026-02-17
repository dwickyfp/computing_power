"""
Celery application factory and configuration.

Configures Celery with Redis broker and PostgreSQL result backend.
"""

from celery import Celery

from app.config.settings import get_settings
from app.core.logging import setup_logging

# Initialize logging
setup_logging()

settings = get_settings()

# Create Celery app
celery_app = Celery(
    "rosetta_worker",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

# Celery Configuration
celery_app.conf.update(
    # Serialization
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",

    # Time limits
    task_soft_time_limit=settings.task_soft_time_limit,
    task_time_limit=settings.task_hard_time_limit,

    # Result settings
    result_expires=3600,  # Results expire after 1 hour
    result_extended=True,  # Store task args, name, etc.

    # Task routing
    task_routes={
        "app.tasks.preview.task.*": {"queue": "preview"},
    },

    # Default queue
    task_default_queue="default",

    # Worker settings
    worker_concurrency=settings.worker_concurrency,
    worker_prefetch_multiplier=1,  # Fair scheduling

    # Task behavior
    task_acks_late=True,  # Ack after task completes (crash safety)
    task_reject_on_worker_lost=False,  # Don't re-queue on worker crash (prevents infinite loops)
    task_track_started=True,  # Track STARTED state

    # Timezone
    timezone="UTC",
    enable_utc=True,
)

# Auto-discover tasks from the tasks package
celery_app.autodiscover_tasks(["app.tasks.preview"])
