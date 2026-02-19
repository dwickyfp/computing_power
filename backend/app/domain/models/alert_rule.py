"""
Alert Rules Engine models.

Configurable alerting rules with history tracking.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.domain.models.base import Base, TimestampMixin


class AlertRule(Base, TimestampMixin):
    """Configurable alerting rule evaluated periodically."""

    __tablename__ = "alert_rules"
    __table_args__ = {"comment": "Configurable alerting rules evaluated by scheduler"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metric_type: Mapped[str] = mapped_column(
        String(50), nullable=False,
        comment="REPLICATION_LAG, WAL_SIZE, PIPELINE_ERROR, CPU_USAGE, MEMORY_USAGE, CUSTOM_QUERY",
    )
    condition_operator: Mapped[str] = mapped_column(
        String(10), nullable=False, comment="GT, GTE, LT, LTE, EQ, NEQ"
    )
    threshold_value: Mapped[float] = mapped_column(Float, nullable=False)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0)
    source_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("sources.id", ondelete="CASCADE"), nullable=True
    )
    destination_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("destinations.id", ondelete="CASCADE"), nullable=True
    )
    pipeline_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("pipelines.id", ondelete="CASCADE"), nullable=True
    )
    notification_channels: Mapped[Optional[list]] = mapped_column(
        ARRAY(Text), default=lambda: ["webhook", "telegram"]
    )
    cooldown_minutes: Mapped[int] = mapped_column(Integer, default=15)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    last_triggered_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    trigger_count: Mapped[int] = mapped_column(Integer, default=0)
    custom_query: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    history: Mapped[list["AlertHistory"]] = relationship(
        "AlertHistory",
        back_populates="alert_rule",
        lazy="select",
        cascade="all, delete-orphan",
        order_by="AlertHistory.created_at.desc()",
    )


class AlertHistory(Base):
    """History of triggered alerts."""

    __tablename__ = "alert_history"
    __table_args__ = {"comment": "History of triggered alerts"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    alert_rule_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("alert_rules.id", ondelete="CASCADE"), nullable=False
    )
    metric_value: Mapped[float] = mapped_column(Float, nullable=False)
    threshold_value: Mapped[float] = mapped_column(Float, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    notification_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(__import__("zoneinfo").ZoneInfo("Asia/Jakarta")),
        nullable=False,
    )

    # Relationships
    alert_rule: Mapped["AlertRule"] = relationship(
        "AlertRule", back_populates="history", lazy="selectin"
    )
