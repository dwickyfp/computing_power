"""
Flow Task service — orchestrates all flow task business logic.

Handles CRUD, graph persistence, run triggering via Celery,
node preview, and run history retrieval.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.core.exceptions import EntityNotFoundError
from app.core.logging import get_logger
from app.domain.models.flow_task import (
    FlowTask,
    FlowTaskGraph,
    FlowTaskRunHistory,
    FlowTaskRunNodeLog,
    FlowTaskRunStatus,
    FlowTaskStatus,
    FlowTaskTriggerType,
)
from app.domain.repositories.flow_task import (
    FlowTaskGraphRepository,
    FlowTaskRepository,
    FlowTaskRunHistoryRepository,
    FlowTaskRunNodeLogRepository,
)
from app.domain.schemas.flow_task import (
    FlowTaskCreate,
    FlowTaskGraphSave,
    FlowTaskUpdate,
    NodePreviewRequest,
)

logger = get_logger(__name__)


class FlowTaskService:
    """
    Business logic for Flow Task management.

    Coordinates between repositories, Celery worker client, and
    enforces domain rules.
    """

    def __init__(self, db: Session):
        self.db = db
        self.flow_task_repo = FlowTaskRepository(db)
        self.graph_repo = FlowTaskGraphRepository(db)
        self.run_history_repo = FlowTaskRunHistoryRepository(db)
        self.node_log_repo = FlowTaskRunNodeLogRepository(db)

    # ─── CRUD ─────────────────────────────────────────────────────────────────

    def create_flow_task(self, data: FlowTaskCreate) -> FlowTask:
        """Create a new flow task."""
        flow_task = self.flow_task_repo.create(
            name=data.name,
            description=data.description,
            status=FlowTaskStatus.IDLE,
            trigger_type=data.trigger_type,
        )
        self.db.commit()
        self.db.refresh(flow_task)
        logger.info(f"FlowTask created: id={flow_task.id} name={flow_task.name}")
        return flow_task

    def get_flow_task(self, flow_task_id: int) -> FlowTask:
        """Get a flow task by ID. Raises EntityNotFoundError if missing."""
        task = self.flow_task_repo.get_by_id(flow_task_id)
        if not task:
            raise EntityNotFoundError(f"FlowTask {flow_task_id} not found")
        return task

    def list_flow_tasks(
        self, skip: int = 0, limit: int = 20
    ) -> Tuple[List[FlowTask], int]:
        """Return paginated list of all flow tasks."""
        return self.flow_task_repo.get_all_paginated(skip=skip, limit=limit)

    def update_flow_task(self, flow_task_id: int, data: FlowTaskUpdate) -> FlowTask:
        """Update flow task metadata."""
        # Ensure exists
        self.get_flow_task(flow_task_id)
        update_kwargs = data.dict(exclude_unset=True, exclude_none=True)
        if not update_kwargs:
            return self.get_flow_task(flow_task_id)
        task = self.flow_task_repo.update(flow_task_id, **update_kwargs)
        self.db.commit()
        self.db.refresh(task)
        return task

    def delete_flow_task(self, flow_task_id: int) -> None:
        """Delete a flow task and all its children (cascade)."""
        task = self.get_flow_task(flow_task_id)
        # Prevent deletion while running
        if task.status == FlowTaskStatus.RUNNING:
            raise ValueError(
                f"Cannot delete flow task {flow_task_id} while it is running"
            )
        self.flow_task_repo.delete(flow_task_id)
        self.db.commit()
        logger.info(f"FlowTask deleted: id={flow_task_id}")

    # ─── Graph ─────────────────────────────────────────────────────────────────

    def save_graph(self, flow_task_id: int, data: FlowTaskGraphSave) -> FlowTaskGraph:
        """Upsert the node/edge graph for a flow task."""
        # Ensure parent exists
        self.get_flow_task(flow_task_id)

        nodes_json = [
            {
                "id": n.id,
                "type": n.type,
                "position": {"x": n.position.x, "y": n.position.y},
                "data": n.data,
                **({"label": n.label} if n.label else {}),
            }
            for n in data.nodes
        ]
        edges_json = [
            {
                "id": e.id,
                "source": e.source,
                "target": e.target,
                **({"sourceHandle": e.source_handle} if e.source_handle else {}),
                **({"targetHandle": e.target_handle} if e.target_handle else {}),
            }
            for e in data.edges
        ]

        graph = self.graph_repo.upsert_graph(
            flow_task_id=flow_task_id,
            nodes_json=nodes_json,
            edges_json=edges_json,
        )
        self.db.commit()
        self.db.refresh(graph)
        logger.info(
            f"Graph saved: flow_task_id={flow_task_id} version={graph.version} "
            f"nodes={len(nodes_json)} edges={len(edges_json)}"
        )
        return graph

    def get_graph(self, flow_task_id: int) -> Optional[FlowTaskGraph]:
        """Get the saved graph for a flow task (None if not yet saved)."""
        self.get_flow_task(flow_task_id)
        return self.graph_repo.get_by_flow_task_id(flow_task_id)

    # ─── Run Triggering ────────────────────────────────────────────────────────

    def trigger_run(
        self,
        flow_task_id: int,
        trigger_type: str = FlowTaskTriggerType.MANUAL,
    ) -> Dict[str, Any]:
        """
        Trigger a flow task execution.

        1. Load graph; raise if no graph saved
        2. Set flow_task.status = RUNNING
        3. Create FlowTaskRunHistory record
        4. Dispatch Celery task via WorkerClient
        5. Update run record with celery_task_id
        Returns {run_id, celery_task_id, status}
        """
        from app.infrastructure.worker_client import get_worker_client

        task = self.get_flow_task(flow_task_id)
        graph = self.graph_repo.get_by_flow_task_id(flow_task_id)
        if not graph:
            raise ValueError(
                f"FlowTask {flow_task_id} has no saved graph. "
                "Please build and save the flow before running."
            )

        # Check not already running
        if task.status == FlowTaskStatus.RUNNING:
            raise ValueError(
                f"FlowTask {flow_task_id} is already running"
            )

        # Mark flow as RUNNING
        self.flow_task_repo.update(flow_task_id, status=FlowTaskStatus.RUNNING)

        # Create run history record
        run = self.run_history_repo.create(
            flow_task_id=flow_task_id,
            trigger_type=trigger_type,
            status=FlowTaskRunStatus.RUNNING,
            started_at=datetime.now(ZoneInfo("Asia/Jakarta")),
            run_metadata={
                "graph_version": graph.version,
                "node_count": len(graph.nodes_json),
                "edge_count": len(graph.edges_json),
            },
        )
        self.db.flush()

        # Dispatch to Celery
        try:
            worker_client = get_worker_client()
            graph_json = {
                "nodes": graph.nodes_json,
                "edges": graph.edges_json,
            }
            celery_task_id = worker_client.submit_flow_task_execute(
                flow_task_id=flow_task_id,
                run_history_id=run.id,
                graph_json=graph_json,
            )
            # Update run with celery task id
            self.run_history_repo.update(run.id, celery_task_id=celery_task_id)
            self.db.commit()
        except Exception as e:
            # Rollback run to FAILED if dispatch fails
            self.run_history_repo.complete_run(
                run_id=run.id,
                status=FlowTaskRunStatus.FAILED,
                finished_at=datetime.now(ZoneInfo("Asia/Jakarta")),
                error_message=f"Failed to dispatch task: {e}",
            )
            self.flow_task_repo.update(
                flow_task_id,
                status=FlowTaskStatus.FAILED,
                last_run_at=datetime.now(ZoneInfo("Asia/Jakarta")),
                last_run_status=FlowTaskRunStatus.FAILED,
            )
            self.db.commit()
            raise ConnectionError(f"Worker task dispatch failed: {e}") from e

        logger.info(
            f"FlowTask run triggered: flow_task_id={flow_task_id} "
            f"run_id={run.id} celery_task_id={celery_task_id}"
        )
        return {
            "run_id": run.id,
            "celery_task_id": celery_task_id,
            "status": "RUNNING",
            "message": "Flow task execution started",
        }

    # ─── Node Preview ──────────────────────────────────────────────────────────

    def preview_node(
        self,
        flow_task_id: int,
        request: NodePreviewRequest,
    ) -> Dict[str, Any]:
        """
        Submit a node preview task to the Celery worker.

        Accepts an unsaved graph snapshot so preview works before saving.
        Returns {task_id} for polling.
        """
        from app.infrastructure.worker_client import get_worker_client

        # Ensure flow task exists
        self.get_flow_task(flow_task_id)

        graph_snapshot = {
            "nodes": [
                {
                    "id": n.id,
                    "type": n.type,
                    "position": {"x": n.position.x, "y": n.position.y},
                    "data": n.data,
                }
                for n in request.nodes
            ],
            "edges": [
                {
                    "id": e.id,
                    "source": e.source,
                    "target": e.target,
                    **({"sourceHandle": e.source_handle} if e.source_handle else {}),
                    **({"targetHandle": e.target_handle} if e.target_handle else {}),
                }
                for e in request.edges
            ],
        }

        try:
            worker_client = get_worker_client()
            task_id = worker_client.submit_flow_task_preview(
                flow_task_id=flow_task_id,
                node_id=request.node_id,
                graph_snapshot=graph_snapshot,
                limit=request.limit,
            )
        except Exception as e:
            raise ConnectionError(f"Worker preview dispatch failed: {e}") from e

        return {
            "task_id": task_id,
            "status": "PENDING",
            "message": "Preview task submitted",
        }

    # ─── Run History ───────────────────────────────────────────────────────────

    def get_run_history(
        self,
        flow_task_id: int,
        skip: int = 0,
        limit: int = 20,
    ) -> Tuple[List[FlowTaskRunHistory], int]:
        """Return paginated run history for a flow task."""
        self.get_flow_task(flow_task_id)
        return self.run_history_repo.get_by_flow_task_paginated(
            flow_task_id=flow_task_id, skip=skip, limit=limit
        )

    def get_run_detail(self, run_id: int) -> FlowTaskRunHistory:
        """Get a single run history record with node logs."""
        run = self.run_history_repo.get_by_id(run_id)
        if not run:
            raise EntityNotFoundError(f"RunHistory {run_id} not found")
        return run

    def get_task_status(self, celery_task_id: str) -> Dict[str, Any]:
        """
        Poll the Celery worker for task status.

        Also updates the run history record if the task has completed.
        """
        from app.infrastructure.worker_client import get_worker_client

        worker_client = get_worker_client()
        status = worker_client.get_task_status(celery_task_id)

        # Sync terminal states back to DB
        if status["state"] in ("SUCCESS", "FAILURE") and status["state"] != "UNKNOWN":
            run = self.run_history_repo.get_by_celery_task_id(celery_task_id)
            if run and run.status == FlowTaskRunStatus.RUNNING:
                is_success = status["state"] == "SUCCESS"
                result_data = status.get("result") or {}
                self.run_history_repo.complete_run(
                    run_id=run.id,
                    status=FlowTaskRunStatus.SUCCESS if is_success else FlowTaskRunStatus.FAILED,
                    finished_at=datetime.now(ZoneInfo("Asia/Jakarta")),
                    total_input_records=result_data.get("total_input_records", 0),
                    total_output_records=result_data.get("total_output_records", 0),
                    error_message=status.get("error") if not is_success else None,
                )
                self.flow_task_repo.update_run_summary(
                    flow_task_id=run.flow_task_id,
                    status=FlowTaskStatus.SUCCESS if is_success else FlowTaskStatus.FAILED,
                    last_run_at=datetime.now(ZoneInfo("Asia/Jakarta")),
                    last_run_status=FlowTaskRunStatus.SUCCESS if is_success else FlowTaskRunStatus.FAILED,
                    last_run_record_count=result_data.get("total_output_records"),
                )
                self.db.commit()

        return status
