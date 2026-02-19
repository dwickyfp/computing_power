"""
Integration tests for Alert Rules API endpoints (D3).

Tests alert rule CRUD, toggle, and history operations.
Uses SimpleNamespace to satisfy Pydantic v1 from_orm() validation.
"""

import pytest
from types import SimpleNamespace
from unittest.mock import MagicMock
from datetime import datetime
from fastapi.testclient import TestClient

from app.main import app
from app.api.deps import get_alert_rule_service
from app.core.exceptions import EntityNotFoundError

NOW = datetime(2025, 1, 1, 0, 0, 0)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def make_rule(id=1, **kw):
    """Build a SimpleNamespace that satisfies AlertRuleResponse.from_orm."""
    return SimpleNamespace(
        id=id,
        name=kw.get("name", "High Error Rate"),
        metric_type=kw.get("metric_type", "pipeline_error_rate"),
        condition_operator=kw.get("condition_operator", "gt"),
        threshold_value=kw.get("threshold_value", 5.0),
        duration_seconds=kw.get("duration_seconds", 0),
        source_id=kw.get("source_id"),
        destination_id=kw.get("destination_id"),
        pipeline_id=kw.get("pipeline_id"),
        notification_channels=kw.get("notification_channels", ["notification_log"]),
        cooldown_minutes=kw.get("cooldown_minutes", 5),
        is_enabled=kw.get("is_enabled", True),
        last_triggered_at=kw.get("last_triggered_at"),
        last_value=kw.get("last_value"),
        trigger_count=kw.get("trigger_count", 0),
        created_at=NOW,
        updated_at=NOW,
    )


def make_history(id=1, alert_rule_id=1, **kw):
    """Build a SimpleNamespace that satisfies AlertHistoryResponse.from_orm."""
    return SimpleNamespace(
        id=id,
        alert_rule_id=alert_rule_id,
        metric_value=kw.get("metric_value", 12.5),
        threshold_value=kw.get("threshold_value", 5.0),
        message=kw.get("message", "Error rate exceeded threshold"),
        notification_sent=kw.get("notification_sent", True),
        resolved_at=kw.get("resolved_at"),
        created_at=NOW,
    )


@pytest.fixture
def mock_service():
    return MagicMock()


@pytest.fixture
def client(mock_service):
    app.dependency_overrides[get_alert_rule_service] = lambda: mock_service
    yield TestClient(app)
    app.dependency_overrides.clear()


# ─── Rule CRUD Tests ─────────────────────────────────────────────────────────

class TestCreateRule:
    def test_create_success(self, client, mock_service):
        mock_service.create_rule.return_value = make_rule()

        resp = client.post(
            "/api/v1/alert-rules",
            json={
                "name": "High Error Rate",
                "metric_type": "pipeline_error_rate",
                "condition_operator": "gt",
                "threshold_value": 5.0,
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "High Error Rate"
        assert data["metric_type"] == "pipeline_error_rate"
        mock_service.create_rule.assert_called_once()

    def test_create_failure(self, client, mock_service):
        mock_service.create_rule.side_effect = Exception("duplicate name")

        resp = client.post(
            "/api/v1/alert-rules",
            json={
                "name": "Test",
                "metric_type": "cpu_usage",
                "condition_operator": "gt",
                "threshold_value": 90,
            },
        )
        assert resp.status_code == 400


class TestListRules:
    def test_list_success(self, client, mock_service):
        rules = [make_rule(id=1), make_rule(id=2, name="Low Throughput")]
        mock_service.list_rules.return_value = (rules, 2)

        resp = client.get("/api/v1/alert-rules")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 2
        assert len(data["items"]) == 2

    def test_list_with_pagination(self, client, mock_service):
        mock_service.list_rules.return_value = ([], 0)
        resp = client.get("/api/v1/alert-rules?page=3&page_size=5")
        assert resp.status_code == 200
        call_kw = mock_service.list_rules.call_args[1]
        assert call_kw["skip"] == 10
        assert call_kw["limit"] == 5


class TestGetRule:
    def test_get_success(self, client, mock_service):
        mock_service.get_rule.return_value = make_rule()
        resp = client.get("/api/v1/alert-rules/1")
        assert resp.status_code == 200
        assert resp.json()["metric_type"] == "pipeline_error_rate"

    def test_get_not_found(self, client, mock_service):
        mock_service.get_rule.side_effect = EntityNotFoundError("AlertRule", 999)
        resp = client.get("/api/v1/alert-rules/999")
        assert resp.status_code == 404


class TestUpdateRule:
    def test_update_success(self, client, mock_service):
        mock_service.update_rule.return_value = make_rule(threshold_value=10.0)
        resp = client.put(
            "/api/v1/alert-rules/1",
            json={"threshold_value": 10.0},
        )
        assert resp.status_code == 200
        assert resp.json()["threshold_value"] == 10.0

    def test_update_not_found(self, client, mock_service):
        mock_service.update_rule.side_effect = EntityNotFoundError("AlertRule", 999)
        resp = client.put("/api/v1/alert-rules/999", json={"name": "x"})
        assert resp.status_code == 404


class TestDeleteRule:
    def test_delete_success(self, client, mock_service):
        mock_service.delete_rule.return_value = None
        resp = client.delete("/api/v1/alert-rules/1")
        assert resp.status_code == 204

    def test_delete_not_found(self, client, mock_service):
        mock_service.delete_rule.side_effect = EntityNotFoundError("AlertRule", 999)
        resp = client.delete("/api/v1/alert-rules/999")
        assert resp.status_code == 404


# ─── Toggle Tests ────────────────────────────────────────────────────────────

class TestToggleRule:
    def test_toggle_enable(self, client, mock_service):
        mock_service.toggle_rule.return_value = make_rule(is_enabled=True)
        resp = client.post("/api/v1/alert-rules/1/toggle?enabled=true")
        assert resp.status_code == 200
        assert resp.json()["is_enabled"] is True

    def test_toggle_disable(self, client, mock_service):
        mock_service.toggle_rule.return_value = make_rule(is_enabled=False)
        resp = client.post("/api/v1/alert-rules/1/toggle?enabled=false")
        assert resp.status_code == 200
        assert resp.json()["is_enabled"] is False

    def test_toggle_not_found(self, client, mock_service):
        mock_service.toggle_rule.side_effect = EntityNotFoundError("AlertRule", 1)
        resp = client.post("/api/v1/alert-rules/1/toggle?enabled=true")
        assert resp.status_code == 404


# ─── History Tests ───────────────────────────────────────────────────────────

class TestListHistory:
    def test_history_success(self, client, mock_service):
        history = [make_history(id=1), make_history(id=2)]
        mock_service.get_rule_history.return_value = (history, 2)

        resp = client.get("/api/v1/alert-rules/1/history")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 2
        assert len(data["items"]) == 2

    def test_history_not_found(self, client, mock_service):
        mock_service.get_rule_history.side_effect = EntityNotFoundError("AlertRule", 999)
        resp = client.get("/api/v1/alert-rules/999/history")
        assert resp.status_code == 404
