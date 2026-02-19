"""
Alert Rules API endpoints.

Provides REST API for managing alerting rules and viewing alert history.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_alert_rule_service
from app.core.exceptions import EntityNotFoundError
from app.core.logging import get_logger
from app.domain.schemas.alert_rule import (
    AlertHistoryListResponse,
    AlertHistoryResponse,
    AlertRuleCreate,
    AlertRuleListResponse,
    AlertRuleResponse,
    AlertRuleUpdate,
)
from app.domain.services.alert_rule import AlertRuleService

logger = get_logger(__name__)
router = APIRouter()


@router.post(
    "",
    response_model=AlertRuleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create alert rule",
)
def create_rule(
    data: AlertRuleCreate,
    service: AlertRuleService = Depends(get_alert_rule_service),
) -> AlertRuleResponse:
    """Create a new alert rule."""
    try:
        rule = service.create_rule(data)
        return AlertRuleResponse.from_orm(rule)
    except Exception as e:
        logger.error(f"Failed to create alert rule: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "",
    response_model=AlertRuleListResponse,
    summary="List alert rules",
)
def list_rules(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    service: AlertRuleService = Depends(get_alert_rule_service),
) -> AlertRuleListResponse:
    """List alert rules with pagination."""
    skip = (page - 1) * page_size
    items, total = service.list_rules(skip=skip, limit=page_size)
    return AlertRuleListResponse(
        items=[AlertRuleResponse.from_orm(r) for r in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{rule_id}",
    response_model=AlertRuleResponse,
    summary="Get alert rule",
)
def get_rule(
    rule_id: int,
    service: AlertRuleService = Depends(get_alert_rule_service),
) -> AlertRuleResponse:
    """Get an alert rule by ID."""
    try:
        rule = service.get_rule(rule_id)
        return AlertRuleResponse.from_orm(rule)
    except EntityNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put(
    "/{rule_id}",
    response_model=AlertRuleResponse,
    summary="Update alert rule",
)
def update_rule(
    rule_id: int,
    data: AlertRuleUpdate,
    service: AlertRuleService = Depends(get_alert_rule_service),
) -> AlertRuleResponse:
    """Update an alert rule."""
    try:
        rule = service.update_rule(rule_id, data)
        return AlertRuleResponse.from_orm(rule)
    except EntityNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete(
    "/{rule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete alert rule",
)
def delete_rule(
    rule_id: int,
    service: AlertRuleService = Depends(get_alert_rule_service),
) -> None:
    """Delete an alert rule and its history."""
    try:
        service.delete_rule(rule_id)
    except EntityNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post(
    "/{rule_id}/toggle",
    response_model=AlertRuleResponse,
    summary="Toggle alert rule",
)
def toggle_rule(
    rule_id: int,
    enabled: bool = Query(..., description="Enable or disable the rule"),
    service: AlertRuleService = Depends(get_alert_rule_service),
) -> AlertRuleResponse:
    """Enable or disable an alert rule."""
    try:
        rule = service.toggle_rule(rule_id, enabled)
        return AlertRuleResponse.from_orm(rule)
    except EntityNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ─── Alert History ─────────────────────────────────────────────────────────────

@router.get(
    "/{rule_id}/history",
    response_model=AlertHistoryListResponse,
    summary="List alert history",
)
def list_alert_history(
    rule_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    service: AlertRuleService = Depends(get_alert_rule_service),
) -> AlertHistoryListResponse:
    """List alert history for a rule."""
    try:
        skip = (page - 1) * page_size
        items, total = service.get_rule_history(
            rule_id=rule_id, skip=skip, limit=page_size
        )
        return AlertHistoryListResponse(
            items=[AlertHistoryResponse.from_orm(h) for h in items],
            total=total,
            page=page,
            page_size=page_size,
        )
    except EntityNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
