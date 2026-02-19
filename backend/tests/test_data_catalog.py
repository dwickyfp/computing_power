"""
Integration tests for Data Catalog API endpoints (D2).

Tests the REST API for catalog CRUD and data dictionary operations.
Uses SimpleNamespace to satisfy Pydantic v1 from_orm() validation.
"""

import pytest
from types import SimpleNamespace
from unittest.mock import MagicMock
from datetime import datetime
from fastapi.testclient import TestClient

from app.main import app
from app.api.deps import get_data_catalog_service
from app.core.exceptions import EntityNotFoundError

NOW = datetime(2025, 1, 1, 0, 0, 0)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def make_catalog(id=1, **kw):
    """Build a SimpleNamespace that satisfies DataCatalogResponse.from_orm."""
    return SimpleNamespace(
        id=id,
        source_id=kw.get("source_id"),
        destination_id=kw.get("destination_id"),
        schema_name=kw.get("schema_name", "public"),
        table_name=kw.get("table_name", "users"),
        description=kw.get("description", "Test table"),
        owner=kw.get("owner", "data-team"),
        classification=kw.get("classification"),
        sla_freshness_minutes=kw.get("sla_freshness_minutes"),
        tags=kw.get("tags", []),
        custom_properties=kw.get("custom_properties", {}),
        columns=kw.get("columns", []),
        created_at=NOW,
        updated_at=NOW,
    )


def make_column(id=1, catalog_id=1, **kw):
    """Build a SimpleNamespace that satisfies DataDictionaryResponse.from_orm."""
    return SimpleNamespace(
        id=id,
        catalog_id=catalog_id,
        column_name=kw.get("column_name", "id"),
        data_type=kw.get("data_type", "integer"),
        description=kw.get("description", "Primary key"),
        is_pii=kw.get("is_pii", False),
        is_nullable=kw.get("is_nullable", False),
        sample_values=kw.get("sample_values"),
        business_rule=kw.get("business_rule"),
        created_at=NOW,
        updated_at=NOW,
    )


@pytest.fixture
def mock_service():
    return MagicMock()


@pytest.fixture
def client(mock_service):
    app.dependency_overrides[get_data_catalog_service] = lambda: mock_service
    yield TestClient(app)
    app.dependency_overrides.clear()


# ─── Catalog CRUD Tests ──────────────────────────────────────────────────────

class TestCreateCatalog:
    def test_create_success(self, client, mock_service):
        mock_service.create_catalog.return_value = make_catalog()

        resp = client.post(
            "/api/v1/data-catalog",
            json={"schema_name": "public", "table_name": "users"},
        )
        assert resp.status_code == 201
        assert resp.json()["table_name"] == "users"
        mock_service.create_catalog.assert_called_once()

    def test_create_failure(self, client, mock_service):
        mock_service.create_catalog.side_effect = Exception("duplicate")
        resp = client.post(
            "/api/v1/data-catalog",
            json={"schema_name": "public", "table_name": "users"},
        )
        assert resp.status_code == 400


class TestListCatalogs:
    def test_list_success(self, client, mock_service):
        catalogs = [make_catalog(id=1), make_catalog(id=2, table_name="orders")]
        mock_service.list_catalogs.return_value = (catalogs, 2)

        resp = client.get("/api/v1/data-catalog")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 2
        assert len(data["items"]) == 2

    def test_list_with_search(self, client, mock_service):
        mock_service.list_catalogs.return_value = ([], 0)
        resp = client.get("/api/v1/data-catalog?search=users")
        assert resp.status_code == 200
        call_kw = mock_service.list_catalogs.call_args[1]
        assert call_kw["search"] == "users"

    def test_list_with_pagination(self, client, mock_service):
        mock_service.list_catalogs.return_value = ([], 0)
        resp = client.get("/api/v1/data-catalog?page=2&page_size=10")
        assert resp.status_code == 200
        call_kw = mock_service.list_catalogs.call_args[1]
        assert call_kw["skip"] == 10
        assert call_kw["limit"] == 10


class TestGetCatalog:
    def test_get_success(self, client, mock_service):
        mock_service.get_catalog.return_value = make_catalog()
        resp = client.get("/api/v1/data-catalog/1")
        assert resp.status_code == 200
        assert resp.json()["table_name"] == "users"

    def test_get_not_found(self, client, mock_service):
        mock_service.get_catalog.side_effect = EntityNotFoundError("DataCatalog", 999)
        resp = client.get("/api/v1/data-catalog/999")
        assert resp.status_code == 404


class TestUpdateCatalog:
    def test_update_success(self, client, mock_service):
        mock_service.update_catalog.return_value = make_catalog(description="Updated")
        resp = client.put(
            "/api/v1/data-catalog/1",
            json={"description": "Updated"},
        )
        assert resp.status_code == 200
        assert resp.json()["description"] == "Updated"

    def test_update_not_found(self, client, mock_service):
        mock_service.update_catalog.side_effect = EntityNotFoundError("DataCatalog", 999)
        resp = client.put("/api/v1/data-catalog/999", json={"description": "x"})
        assert resp.status_code == 404


class TestDeleteCatalog:
    def test_delete_success(self, client, mock_service):
        mock_service.delete_catalog.return_value = None
        resp = client.delete("/api/v1/data-catalog/1")
        assert resp.status_code == 204

    def test_delete_not_found(self, client, mock_service):
        mock_service.delete_catalog.side_effect = EntityNotFoundError("DataCatalog", 999)
        resp = client.delete("/api/v1/data-catalog/999")
        assert resp.status_code == 404


# ─── Data Dictionary (columns) Tests ─────────────────────────────────────────

class TestListColumns:
    def test_list_columns_success(self, client, mock_service):
        cols = [make_column(id=1), make_column(id=2, column_name="name")]
        mock_service.list_columns.return_value = cols
        resp = client.get("/api/v1/data-catalog/1/columns")
        assert resp.status_code == 200
        assert len(resp.json()) == 2


class TestAddColumn:
    def test_add_column_success(self, client, mock_service):
        mock_service.add_column.return_value = make_column()
        resp = client.post(
            "/api/v1/data-catalog/1/columns",
            json={"column_name": "id", "data_type": "integer"},
        )
        assert resp.status_code == 201
        assert resp.json()["column_name"] == "id"


class TestUpdateColumn:
    def test_update_column_success(self, client, mock_service):
        mock_service.update_column.return_value = make_column(description="Updated")
        resp = client.put(
            "/api/v1/data-catalog/columns/1",
            json={"description": "Updated"},
        )
        assert resp.status_code == 200


class TestDeleteColumn:
    def test_delete_column_success(self, client, mock_service):
        mock_service.delete_column.return_value = None
        resp = client.delete("/api/v1/data-catalog/columns/1")
        assert resp.status_code == 204
