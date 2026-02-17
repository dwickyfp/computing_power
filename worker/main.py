"""
Worker main entry point.

Usage:
    # Start worker
    celery -A main worker --loglevel=info -Q preview,default

    # Start with specific concurrency
    celery -A main worker --loglevel=info -Q preview -c 4

    # Monitor with Flower (optional)
    celery -A main flower --port=5555
"""

from app.celery_app import celery_app  # noqa: F401

# Import tasks to register them
from app.tasks.preview.task import execute_preview_task  # noqa: F401


if __name__ == "__main__":
    celery_app.start()
