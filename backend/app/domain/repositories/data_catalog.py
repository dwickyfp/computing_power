"""
Data Catalog & Dictionary repository.
"""

from typing import List, Optional

from sqlalchemy import desc, func, select, or_
from sqlalchemy.orm import Session

from app.domain.models.data_catalog import DataCatalog, DataDictionary
from app.domain.repositories.base import BaseRepository


class DataCatalogRepository(BaseRepository[DataCatalog]):
    """Repository for DataCatalog CRUD."""

    def __init__(self, db: Session):
        super().__init__(DataCatalog, db)

    def get_all_paginated(
        self, skip: int = 0, limit: int = 20, search: str = None
    ) -> tuple[List[DataCatalog], int]:
        stmt = select(DataCatalog)
        count_stmt = select(func.count()).select_from(DataCatalog)

        if search:
            filter_cond = or_(
                DataCatalog.table_name.ilike(f"%{search}%"),
                DataCatalog.description.ilike(f"%{search}%"),
                DataCatalog.owner.ilike(f"%{search}%"),
            )
            stmt = stmt.where(filter_cond)
            count_stmt = count_stmt.where(filter_cond)

        total = self.db.execute(count_stmt).scalar_one()
        items = list(
            self.db.execute(
                stmt.order_by(desc(DataCatalog.updated_at)).offset(skip).limit(limit)
            ).scalars().all()
        )
        return items, total

    def get_by_table(
        self, table_name: str, source_id: int = None, destination_id: int = None
    ) -> Optional[DataCatalog]:
        stmt = select(DataCatalog).where(DataCatalog.table_name == table_name)
        if source_id:
            stmt = stmt.where(DataCatalog.source_id == source_id)
        if destination_id:
            stmt = stmt.where(DataCatalog.destination_id == destination_id)
        return self.db.execute(stmt).scalars().first()


class DataDictionaryRepository(BaseRepository[DataDictionary]):
    """Repository for DataDictionary CRUD."""

    def __init__(self, db: Session):
        super().__init__(DataDictionary, db)

    def get_by_catalog_id(self, catalog_id: int) -> List[DataDictionary]:
        stmt = (
            select(DataDictionary)
            .where(DataDictionary.catalog_id == catalog_id)
            .order_by(DataDictionary.column_name)
        )
        return list(self.db.execute(stmt).scalars().all())

    def upsert_column(
        self, catalog_id: int, column_name: str, **kwargs
    ) -> DataDictionary:
        stmt = select(DataDictionary).where(
            DataDictionary.catalog_id == catalog_id,
            DataDictionary.column_name == column_name,
        )
        existing = self.db.execute(stmt).scalars().first()
        if existing:
            for key, value in kwargs.items():
                if hasattr(existing, key) and value is not None:
                    setattr(existing, key, value)
            self.db.flush()
            return existing
        return self.create(catalog_id=catalog_id, column_name=column_name, **kwargs)
