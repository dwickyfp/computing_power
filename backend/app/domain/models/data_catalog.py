"""
Data Catalog & Dictionary models.

Table-level catalog and column-level dictionary for data documentation.
"""

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.domain.models.base import Base, TimestampMixin


class DataCatalog(Base, TimestampMixin):
    """Table-level data catalog entry."""

    __tablename__ = "data_catalog"
    __table_args__ = (
        UniqueConstraint(
            "source_id", "destination_id", "schema_name", "table_name",
            name="uq_data_catalog_entry",
        ),
        {"comment": "Table-level data catalog for documenting data assets"},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("sources.id", ondelete="SET NULL"), nullable=True
    )
    destination_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("destinations.id", ondelete="SET NULL"), nullable=True
    )
    table_name: Mapped[str] = mapped_column(String(255), nullable=False)
    schema_name: Mapped[str] = mapped_column(String(255), default="public")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    owner: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    classification: Mapped[str] = mapped_column(
        String(50), default="INTERNAL",
        comment="INTERNAL, CONFIDENTIAL, PUBLIC, RESTRICTED",
    )
    sla_freshness_minutes: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, comment="Max acceptable data age in minutes"
    )
    tags: Mapped[Optional[list]] = mapped_column(ARRAY(Text), default=list)
    custom_properties: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict)

    # Relationships
    columns: Mapped[list["DataDictionary"]] = relationship(
        "DataDictionary",
        back_populates="catalog",
        lazy="selectin",
        cascade="all, delete-orphan",
    )


class DataDictionary(Base, TimestampMixin):
    """Column-level data dictionary entry."""

    __tablename__ = "data_dictionary"
    __table_args__ = (
        UniqueConstraint("catalog_id", "column_name", name="uq_data_dictionary_column"),
        {"comment": "Column-level data dictionary with PII flags"},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    catalog_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("data_catalog.id", ondelete="CASCADE"), nullable=False
    )
    column_name: Mapped[str] = mapped_column(String(255), nullable=False)
    data_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_pii: Mapped[bool] = mapped_column(Boolean, default=False)
    is_nullable: Mapped[bool] = mapped_column(Boolean, default=True)
    sample_values: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    business_rule: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    catalog: Mapped["DataCatalog"] = relationship(
        "DataCatalog", back_populates="columns", lazy="selectin"
    )
