"""
Alert Rules Engine repository.
"""

from datetime import datetime
from typing import List, Optional
from zoneinfo import ZoneInfo

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.domain.models.alert_rule import AlertHistory, AlertRule
from app.domain.repositories.base import BaseRepository


class AlertRuleRepository(BaseRepository[AlertRule]):
    """Repository for AlertRule CRUD."""

    def __init__(self, db: Session):
        super().__init__(AlertRule, db)

    def get_all_paginated(
        self, skip: int = 0, limit: int = 20
    ) -> tuple[List[AlertRule], int]:
        stmt = select(AlertRule).order_by(desc(AlertRule.updated_at))
        total = self.db.execute(
            select(func.count()).select_from(AlertRule)
        ).scalar_one()
        items = list(
            self.db.execute(stmt.offset(skip).limit(limit)).scalars().all()
        )
        return items, total

    def get_enabled_rules(self) -> List[AlertRule]:
        """Get all enabled rules for evaluation."""
        stmt = select(AlertRule).where(AlertRule.is_enabled == True)
        return list(self.db.execute(stmt).scalars().all())

    def update_trigger(
        self, rule_id: int, value: float, triggered_at: datetime
    ) -> Optional[AlertRule]:
        return self.update(
            rule_id,
            last_value=value,
            last_triggered_at=triggered_at,
            trigger_count=AlertRule.trigger_count + 1,
        )


class AlertHistoryRepository(BaseRepository[AlertHistory]):
    """Repository for AlertHistory."""

    def __init__(self, db: Session):
        super().__init__(AlertHistory, db)

    def get_by_rule_paginated(
        self, rule_id: int, skip: int = 0, limit: int = 20
    ) -> tuple[List[AlertHistory], int]:
        stmt = (
            select(AlertHistory)
            .where(AlertHistory.alert_rule_id == rule_id)
            .order_by(desc(AlertHistory.created_at))
        )
        total = self.db.execute(
            select(func.count())
            .select_from(AlertHistory)
            .where(AlertHistory.alert_rule_id == rule_id)
        ).scalar_one()
        items = list(
            self.db.execute(stmt.offset(skip).limit(limit)).scalars().all()
        )
        return items, total

    def get_recent_unresolved(self, rule_id: int) -> Optional[AlertHistory]:
        """Get the most recent unresolved alert for a rule."""
        stmt = (
            select(AlertHistory)
            .where(
                AlertHistory.alert_rule_id == rule_id,
                AlertHistory.resolved_at == None,
            )
            .order_by(desc(AlertHistory.created_at))
            .limit(1)
        )
        return self.db.execute(stmt).scalars().first()
