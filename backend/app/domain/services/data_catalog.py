"""
Data Catalog service — business logic for data catalog & dictionary.
"""

from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.domain.models.data_catalog import DataCatalog, DataDictionary
from app.domain.repositories.data_catalog import (
    DataCatalogRepository,
    DataDictionaryRepository,
)
from app.domain.schemas.data_catalog import (
    DataCatalogCreate,
    DataCatalogUpdate,
    DataDictionaryCreate,
    DataDictionaryUpdate,
)

logger = get_logger(__name__)


class DataCatalogService:
    """Business logic for Data Catalog management."""

    def __init__(self, db: Session):
        self.db = db
        self.catalog_repo = DataCatalogRepository(db)
        self.dictionary_repo = DataDictionaryRepository(db)

    # ─── Catalog CRUD ──────────────────────────────────────────────────────

    def create_catalog(self, data: DataCatalogCreate) -> DataCatalog:
        """Create a new catalog entry."""
        catalog = self.catalog_repo.create(
            source_id=data.source_id,
            destination_id=data.destination_id,
            table_name=data.table_name,
            schema_name=data.schema_name,
            description=data.description,
            owner=data.owner,
            classification=data.classification,
            sla_freshness_minutes=data.sla_freshness_minutes,
            tags=data.tags or [],
            custom_properties=data.custom_properties or {},
        )
        self.db.commit()
        self.db.refresh(catalog)
        logger.info(f"DataCatalog created: id={catalog.id} table={catalog.table_name}")
        return catalog

    def get_catalog(self, catalog_id: int) -> DataCatalog:
        """Get a catalog entry by ID."""
        return self.catalog_repo.get_by_id(catalog_id)

    def list_catalogs(
        self, skip: int = 0, limit: int = 20, search: str = None
    ) -> Tuple[List[DataCatalog], int]:
        """List catalogs with pagination and search."""
        return self.catalog_repo.get_all_paginated(
            skip=skip, limit=limit, search=search
        )

    def update_catalog(
        self, catalog_id: int, data: DataCatalogUpdate
    ) -> DataCatalog:
        """Update catalog metadata."""
        update_kwargs = data.dict(exclude_unset=True, exclude_none=True)
        if not update_kwargs:
            return self.catalog_repo.get_by_id(catalog_id)
        catalog = self.catalog_repo.update(catalog_id, **update_kwargs)
        self.db.commit()
        self.db.refresh(catalog)
        return catalog

    def delete_catalog(self, catalog_id: int) -> None:
        """Delete a catalog entry and its dictionary columns."""
        self.catalog_repo.delete(catalog_id)
        self.db.commit()
        logger.info(f"DataCatalog deleted: id={catalog_id}")

    # ─── Dictionary CRUD ──────────────────────────────────────────────────

    def list_columns(self, catalog_id: int) -> List[DataDictionary]:
        """List all dictionary columns for a catalog."""
        return self.dictionary_repo.get_by_catalog_id(catalog_id)

    def add_column(
        self, catalog_id: int, data: DataDictionaryCreate
    ) -> DataDictionary:
        """Add a column to the data dictionary."""
        # Verify catalog exists
        self.catalog_repo.get_by_id(catalog_id)
        col = self.dictionary_repo.create(
            catalog_id=catalog_id,
            column_name=data.column_name,
            data_type=data.data_type,
            description=data.description,
            is_pii=data.is_pii,
            is_nullable=data.is_nullable,
            sample_values=data.sample_values,
            business_rule=data.business_rule,
        )
        self.db.commit()
        self.db.refresh(col)
        return col

    def update_column(
        self, column_id: int, data: DataDictionaryUpdate
    ) -> DataDictionary:
        """Update a dictionary column."""
        update_kwargs = data.dict(exclude_unset=True, exclude_none=True)
        if not update_kwargs:
            return self.dictionary_repo.get_by_id(column_id)
        col = self.dictionary_repo.update(column_id, **update_kwargs)
        self.db.commit()
        self.db.refresh(col)
        return col

    def delete_column(self, column_id: int) -> None:
        """Delete a dictionary column."""
        self.dictionary_repo.delete(column_id)
        self.db.commit()

    def upsert_column(
        self, catalog_id: int, column_name: str, **kwargs
    ) -> DataDictionary:
        """Upsert a column by catalog + name."""
        col = self.dictionary_repo.upsert_column(
            catalog_id=catalog_id, column_name=column_name, **kwargs
        )
        self.db.commit()
        self.db.refresh(col)
        return col
