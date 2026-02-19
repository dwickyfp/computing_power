"""
Data Catalog & Data Dictionary Pydantic schemas.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import Field, validator

from app.domain.schemas.common import BaseSchema, TimestampSchema


# ─── Data Dictionary schemas ──────────────────────────────────────────────────

class DataDictionaryCreate(BaseSchema):
    """Schema for creating a data dictionary entry."""

    column_name: str = Field(..., min_length=1, max_length=255)
    data_type: str = Field(default="", max_length=100)
    description: Optional[str] = None
    is_pii: bool = False
    is_nullable: bool = True
    sample_values: Optional[str] = None
    business_rule: Optional[str] = None


class DataDictionaryUpdate(BaseSchema):
    """Schema for updating a data dictionary entry."""

    column_name: Optional[str] = Field(default=None, max_length=255)
    data_type: Optional[str] = Field(default=None, max_length=100)
    description: Optional[str] = None
    is_pii: Optional[bool] = None
    is_nullable: Optional[bool] = None
    sample_values: Optional[str] = None
    business_rule: Optional[str] = None


class DataDictionaryResponse(TimestampSchema):
    """Data dictionary entry response."""

    id: int
    catalog_id: int
    column_name: str
    data_type: str
    description: Optional[str]
    is_pii: bool
    is_nullable: bool
    sample_values: Optional[str]
    business_rule: Optional[str]

    class Config:
        orm_mode = True


# ─── Data Catalog schemas ─────────────────────────────────────────────────────

class DataCatalogCreate(BaseSchema):
    """Schema for creating a data catalog entry."""

    source_id: Optional[int] = None
    destination_id: Optional[int] = None
    table_name: str = Field(..., min_length=1, max_length=255)
    schema_name: str = Field(default="public", max_length=100)
    description: Optional[str] = None
    owner: Optional[str] = Field(default=None, max_length=100)
    classification: Optional[str] = Field(default=None, max_length=50)
    sla_freshness_minutes: Optional[int] = None
    tags: Optional[List[str]] = Field(default_factory=list)
    custom_properties: Optional[Dict[str, Any]] = Field(default_factory=dict)

    @validator("table_name")
    def validate_table_name(cls, v: str) -> str:
        return v.strip()


class DataCatalogUpdate(BaseSchema):
    """Schema for updating a data catalog entry."""

    description: Optional[str] = None
    owner: Optional[str] = Field(default=None, max_length=100)
    classification: Optional[str] = Field(default=None, max_length=50)
    sla_freshness_minutes: Optional[int] = None
    tags: Optional[List[str]] = None
    custom_properties: Optional[Dict[str, Any]] = None


class DataCatalogResponse(TimestampSchema):
    """Data catalog entry response."""

    id: int
    source_id: Optional[int]
    destination_id: Optional[int]
    table_name: str
    schema_name: str
    description: Optional[str]
    owner: Optional[str]
    classification: Optional[str]
    sla_freshness_minutes: Optional[int]
    tags: List[str]
    custom_properties: Dict[str, Any]
    columns: List[DataDictionaryResponse] = Field(default_factory=list)

    class Config:
        orm_mode = True


class DataCatalogListResponse(BaseSchema):
    """Paginated data catalog list."""

    items: List[DataCatalogResponse]
    total: int
    page: int
    page_size: int
