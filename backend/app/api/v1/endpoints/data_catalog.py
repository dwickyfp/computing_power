"""
Data Catalog API endpoints.

Provides REST API for managing the data catalog and data dictionary.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_data_catalog_service
from app.core.exceptions import EntityNotFoundError
from app.core.logging import get_logger
from app.domain.schemas.data_catalog import (
    DataCatalogCreate,
    DataCatalogListResponse,
    DataCatalogResponse,
    DataCatalogUpdate,
    DataDictionaryCreate,
    DataDictionaryResponse,
    DataDictionaryUpdate,
)
from app.domain.services.data_catalog import DataCatalogService

logger = get_logger(__name__)
router = APIRouter()


# ─── Catalog CRUD ──────────────────────────────────────────────────────────────

@router.post(
    "",
    response_model=DataCatalogResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create catalog entry",
)
def create_catalog(
    data: DataCatalogCreate,
    service: DataCatalogService = Depends(get_data_catalog_service),
) -> DataCatalogResponse:
    """Create a new data catalog entry."""
    try:
        catalog = service.create_catalog(data)
        return DataCatalogResponse.from_orm(catalog)
    except Exception as e:
        logger.error(f"Failed to create catalog: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
        )


@router.get(
    "",
    response_model=DataCatalogListResponse,
    summary="List catalog entries",
)
def list_catalogs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str = Query(default=None, description="Search by table name, description, or owner"),
    service: DataCatalogService = Depends(get_data_catalog_service),
) -> DataCatalogListResponse:
    """List data catalog entries with pagination and search."""
    skip = (page - 1) * page_size
    items, total = service.list_catalogs(skip=skip, limit=page_size, search=search)
    return DataCatalogListResponse(
        items=[DataCatalogResponse.from_orm(c) for c in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{catalog_id}",
    response_model=DataCatalogResponse,
    summary="Get catalog entry",
)
def get_catalog(
    catalog_id: int,
    service: DataCatalogService = Depends(get_data_catalog_service),
) -> DataCatalogResponse:
    """Get a data catalog entry by ID."""
    try:
        catalog = service.get_catalog(catalog_id)
        return DataCatalogResponse.from_orm(catalog)
    except EntityNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put(
    "/{catalog_id}",
    response_model=DataCatalogResponse,
    summary="Update catalog entry",
)
def update_catalog(
    catalog_id: int,
    data: DataCatalogUpdate,
    service: DataCatalogService = Depends(get_data_catalog_service),
) -> DataCatalogResponse:
    """Update a data catalog entry."""
    try:
        catalog = service.update_catalog(catalog_id, data)
        return DataCatalogResponse.from_orm(catalog)
    except EntityNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete(
    "/{catalog_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete catalog entry",
)
def delete_catalog(
    catalog_id: int,
    service: DataCatalogService = Depends(get_data_catalog_service),
) -> None:
    """Delete a data catalog entry and its dictionary."""
    try:
        service.delete_catalog(catalog_id)
    except EntityNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ─── Data Dictionary ──────────────────────────────────────────────────────────

@router.get(
    "/{catalog_id}/columns",
    response_model=list[DataDictionaryResponse],
    summary="List dictionary columns",
)
def list_columns(
    catalog_id: int,
    service: DataCatalogService = Depends(get_data_catalog_service),
) -> list[DataDictionaryResponse]:
    """List all data dictionary columns for a catalog entry."""
    try:
        columns = service.list_columns(catalog_id)
        return [DataDictionaryResponse.from_orm(c) for c in columns]
    except EntityNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post(
    "/{catalog_id}/columns",
    response_model=DataDictionaryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add dictionary column",
)
def add_column(
    catalog_id: int,
    data: DataDictionaryCreate,
    service: DataCatalogService = Depends(get_data_catalog_service),
) -> DataDictionaryResponse:
    """Add a column to the data dictionary."""
    try:
        col = service.add_column(catalog_id, data)
        return DataDictionaryResponse.from_orm(col)
    except EntityNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put(
    "/columns/{column_id}",
    response_model=DataDictionaryResponse,
    summary="Update dictionary column",
)
def update_column(
    column_id: int,
    data: DataDictionaryUpdate,
    service: DataCatalogService = Depends(get_data_catalog_service),
) -> DataDictionaryResponse:
    """Update a data dictionary column."""
    try:
        col = service.update_column(column_id, data)
        return DataDictionaryResponse.from_orm(col)
    except EntityNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete(
    "/columns/{column_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete dictionary column",
)
def delete_column(
    column_id: int,
    service: DataCatalogService = Depends(get_data_catalog_service),
) -> None:
    """Delete a data dictionary column."""
    try:
        service.delete_column(column_id)
    except EntityNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
