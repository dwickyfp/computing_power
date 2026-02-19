"""
Alert Rules Engine Pydantic schemas.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import Field, validator

from app.domain.schemas.common import BaseSchema, TimestampSchema


class AlertRuleCreate(BaseSchema):
    """Schema for creating an alert rule."""

    name: str = Field(..., min_length=1, max_length=255)
    metric_type: str = Field(
        ...,
        description="Metric: replication_lag, wal_size, error_rate, row_throughput, "
        "cpu_usage, memory_usage, dlq_size, pipeline_status",
    )
    condition_operator: str = Field(
        ..., description="Operator: gt, gte, lt, lte, eq, neq"
    )
    threshold_value: float = Field(..., description="Threshold to trigger alert")
    duration_seconds: int = Field(
        default=0,
        ge=0,
        description="Seconds the condition must hold before triggering",
    )
    source_id: Optional[int] = None
    destination_id: Optional[int] = None
    pipeline_id: Optional[int] = None
    notification_channels: List[str] = Field(
        default_factory=lambda: ["notification_log"],
        description="Channels: notification_log, webhook, telegram",
    )
    cooldown_minutes: int = Field(
        default=5, ge=0, description="Minutes between repeated alerts"
    )
    is_enabled: bool = True
    custom_query: Optional[str] = None

    @validator("name")
    def validate_name(cls, v: str) -> str:
        return v.strip()

    @validator("condition_operator")
    def validate_operator(cls, v: str) -> str:
        valid = {"gt", "gte", "lt", "lte", "eq", "neq"}
        if v not in valid:
            raise ValueError(f"operator must be one of {valid}")
        return v


class AlertRuleUpdate(BaseSchema):
    """Schema for updating an alert rule."""

    name: Optional[str] = Field(default=None, max_length=255)
    metric_type: Optional[str] = None
    condition_operator: Optional[str] = None
    threshold_value: Optional[float] = None
    duration_seconds: Optional[int] = None
    source_id: Optional[int] = None
    destination_id: Optional[int] = None
    pipeline_id: Optional[int] = None
    notification_channels: Optional[List[str]] = None
    cooldown_minutes: Optional[int] = None
    is_enabled: Optional[bool] = None
    custom_query: Optional[str] = None


class AlertRuleResponse(TimestampSchema):
    """Alert rule response."""

    id: int
    name: str
    metric_type: str
    condition_operator: str
    threshold_value: float
    duration_seconds: int
    source_id: Optional[int]
    destination_id: Optional[int]
    pipeline_id: Optional[int]
    notification_channels: List[str]
    cooldown_minutes: int
    is_enabled: bool
    last_triggered_at: Optional[datetime]
    last_value: Optional[float]
    trigger_count: int

    class Config:
        orm_mode = True


class AlertRuleListResponse(BaseSchema):
    """Paginated alert rules list."""

    items: List[AlertRuleResponse]
    total: int
    page: int
    page_size: int


class AlertHistoryResponse(BaseSchema):
    """Alert history entry response."""

    id: int
    alert_rule_id: int
    metric_value: float
    threshold_value: float
    message: Optional[str]
    notification_sent: bool
    resolved_at: Optional[datetime]
    created_at: datetime

    class Config:
        orm_mode = True


class AlertHistoryListResponse(BaseSchema):
    """Paginated alert history list."""

    items: List[AlertHistoryResponse]
    total: int
    page: int
    page_size: int
