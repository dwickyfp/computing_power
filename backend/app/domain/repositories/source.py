"""
Source repository for data access operations.

Extends base repository with source-specific queries.
"""

from typing import List

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.models.source import Source
from app.domain.repositories.base import BaseRepository


class SourceRepository(BaseRepository[Source]):
    """
    Repository for Source entity.

    Provides data access methods for PostgreSQL source configurations.
    """

    def __init__(self, db: Session):
        """Initialize source repository."""
        super().__init__(Source, db)

    def get_sources_with_wal_metrics(
        self, skip: int = 0, limit: int = 100
    ) -> List[Source]:
        """
        Get sources with their latest WAL metrics.

        Args:
            skip: Number of sources to skip
            limit: Maximum number of sources to return

        Returns:
            List of sources with WAL metrics loaded
        """
        result = self.db.execute(select(Source).offset(skip).limit(limit))
        return list(result.scalars().all())

    def get_max_replication_id(self) -> int:
        """
        Get the maximum replication ID currently in use.

        Returns:
            Max replication ID, or 0 if no sources exist.
        """
        from sqlalchemy import func
        result = self.db.execute(select(func.max(Source.replication_id)))
        max_id = result.scalar()
        return max_id if max_id is not None else 0
