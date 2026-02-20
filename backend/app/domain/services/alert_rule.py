"""
Alerting Rules Engine service — evaluates rules and creates alert history.
"""

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.domain.models.alert_rule import AlertHistory, AlertRule
from app.domain.repositories.alert_rule import (
    AlertHistoryRepository,
    AlertRuleRepository,
)
from app.domain.schemas.alert_rule import AlertRuleCreate, AlertRuleUpdate

logger = get_logger(__name__)


class AlertRuleService:
    """Business logic for alert rule management and evaluation."""

    def __init__(self, db: Session):
        self.db = db
        self.rule_repo = AlertRuleRepository(db)
        self.history_repo = AlertHistoryRepository(db)

    # ─── CRUD ─────────────────────────────────────────────────────────────

    def create_rule(self, data: AlertRuleCreate) -> AlertRule:
        """Create a new alert rule."""
        rule = self.rule_repo.create(
            name=data.name,
            description=data.description,
            metric_type=data.metric_type,
            condition_operator=data.condition_operator,
            threshold_value=data.threshold_value,
            duration_seconds=data.duration_seconds,
            source_id=data.source_id,
            destination_id=data.destination_id,
            pipeline_id=data.pipeline_id,
            notification_channels=data.notification_channels,
            cooldown_minutes=data.cooldown_minutes,
            is_enabled=data.is_enabled,
            custom_query=data.custom_query,
        )
        self.db.commit()
        self.db.refresh(rule)
        logger.info(f"AlertRule created: id={rule.id} name={rule.name}")
        return rule

    def get_rule(self, rule_id: int) -> AlertRule:
        """Get a rule by ID."""
        return self.rule_repo.get_by_id(rule_id)

    def list_rules(
        self, skip: int = 0, limit: int = 20
    ) -> Tuple[List[AlertRule], int]:
        """List rules with pagination."""
        return self.rule_repo.get_all_paginated(skip=skip, limit=limit)

    def update_rule(self, rule_id: int, data: AlertRuleUpdate) -> AlertRule:
        """Update a rule."""
        update_kwargs = data.dict(exclude_unset=True, exclude_none=True)
        if not update_kwargs:
            return self.rule_repo.get_by_id(rule_id)
        rule = self.rule_repo.update(rule_id, **update_kwargs)
        self.db.commit()
        self.db.refresh(rule)
        return rule

    def delete_rule(self, rule_id: int) -> None:
        """Delete a rule and its history."""
        self.rule_repo.delete(rule_id)
        self.db.commit()
        logger.info(f"AlertRule deleted: id={rule_id}")

    def toggle_rule(self, rule_id: int, enabled: bool) -> AlertRule:
        """Enable or disable a rule."""
        rule = self.rule_repo.update(rule_id, is_enabled=enabled)
        self.db.commit()
        self.db.refresh(rule)
        return rule

    # ─── History ──────────────────────────────────────────────────────────

    def get_rule_history(
        self, rule_id: int, skip: int = 0, limit: int = 20
    ) -> Tuple[List[AlertHistory], int]:
        """Get paginated alert history for a rule."""
        return self.history_repo.get_by_rule_paginated(
            rule_id=rule_id, skip=skip, limit=limit
        )

    # ─── Evaluation engine ────────────────────────────────────────────────

    def evaluate_all_rules(self, metrics: Dict[str, Any]) -> List[AlertHistory]:
        """
        Evaluate all enabled rules against current metrics.

        Args:
            metrics: Dict with metric_type -> value mappings, e.g.:
                {
                    "wal_size": 1073741824,
                    "replication_lag": 120,
                    "cpu_usage": 85.0,
                    "dlq_size": {"pipeline_1": 500},
                }

        Returns:
            List of newly created AlertHistory entries (triggered alerts).
        """
        rules = self.rule_repo.get_enabled_rules()
        triggered: List[AlertHistory] = []
        now = datetime.now(ZoneInfo("Asia/Jakarta"))

        for rule in rules:
            try:
                value = self._get_metric_value(rule, metrics)
                if value is None:
                    continue

                condition_met = self._check_condition(
                    value, rule.condition_operator, rule.threshold_value
                )

                if condition_met:
                    # Check cooldown
                    if rule.last_triggered_at and rule.cooldown_minutes > 0:
                        cooldown_end = rule.last_triggered_at + timedelta(
                            minutes=rule.cooldown_minutes
                        )
                        if now < cooldown_end:
                            continue

                    # Create alert history
                    history = self.history_repo.create(
                        alert_rule_id=rule.id,
                        metric_value=value,
                        threshold_value=rule.threshold_value,
                        message=(
                            f"Rule '{rule.name}': {rule.metric_type} "
                            f"({value}) {rule.condition_operator} "
                            f"threshold ({rule.threshold_value})"
                        ),
                        notification_sent=False,
                    )

                    # Update rule trigger info
                    self.rule_repo.update_trigger(rule.id, value, now)
                    triggered.append(history)

                else:
                    # Auto-resolve if there's an unresolved alert
                    unresolved = self.history_repo.get_recent_unresolved(rule.id)
                    if unresolved:
                        unresolved.resolved_at = now
                        self.db.flush()

            except Exception as e:
                logger.warning(
                    f"Error evaluating rule {rule.id} ({rule.name}): {e}"
                )

        if triggered:
            self.db.commit()
            logger.info(f"Alert evaluation: {len(triggered)} rules triggered")

        return triggered

    def _get_metric_value(
        self, rule: AlertRule, metrics: Dict[str, Any]
    ) -> Optional[float]:
        """Extract metric value relevant to this rule."""
        value = metrics.get(rule.metric_type)
        if value is None:
            return None
        if isinstance(value, dict):
            # For per-pipeline/source/destination metrics
            key = None
            if rule.pipeline_id:
                key = str(rule.pipeline_id)
            elif rule.source_id:
                key = str(rule.source_id)
            elif rule.destination_id:
                key = str(rule.destination_id)
            if key:
                value = value.get(key)
            else:
                # Use max value across all keys
                value = max(value.values()) if value else None
        if value is None:
            return None
        return float(value)

    @staticmethod
    def _check_condition(
        value: float, operator: str, threshold: float
    ) -> bool:
        """Evaluate condition operator."""
        ops = {
            "gt": lambda v, t: v > t,
            "gte": lambda v, t: v >= t,
            "lt": lambda v, t: v < t,
            "lte": lambda v, t: v <= t,
            "eq": lambda v, t: v == t,
            "neq": lambda v, t: v != t,
        }
        op_func = ops.get(operator)
        if not op_func:
            return False
        return op_func(value, threshold)
