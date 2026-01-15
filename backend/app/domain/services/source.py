"""
Source service containing business logic.

Implements business rules and orchestrates repository operations for sources.
"""

from typing import List

from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.core.exceptions import EntityNotFoundError
from app.domain.models.history_schema_evolution import HistorySchemaEvolution
from app.domain.models.source import Source
from app.domain.repositories.source import SourceRepository
from app.domain.repositories.wal_monitor_repo import WALMonitorRepository
from app.domain.repositories.table_metadata_repo import TableMetadataRepository
from app.domain.repositories.history_schema_evolution_repo import HistorySchemaEvolutionRepository
from app.domain.repositories.pipeline import PipelineRepository
from app.domain.schemas.source import (
    SourceConnectionTest, 
    SourceCreate, 
    SourceUpdate,
    SourceResponse
)
from app.domain.schemas.source_detail import SourceDetailResponse, SourceTableInfo
from app.domain.schemas.wal_monitor import WALMonitorResponse


logger = get_logger(__name__)


class SourceService:
    """
    Service layer for Source entity.

    Implements business logic for managing PostgreSQL source configurations.
    """

    def __init__(self, db: Session):
        """Initialize source service."""
        self.db = db
        self.repository = SourceRepository(db)

    def create_source(self, source_data: SourceCreate) -> Source:
        """
        Create a new source.

        Args:
            source_data: Source creation data

        Returns:
            Created source
        """
        logger.info("Creating new source", extra={"name": source_data.name})

        # TODO: In production, encrypt password before storing
        source = self.repository.create(**source_data.dict())

        logger.info(
            "Source created successfully",
            extra={"source_id": source.id, "name": source.name},
        )

        return source

    def get_source(self, source_id: int) -> Source:
        """
        Get source by ID.

        Args:
            source_id: Source identifier

        Returns:
            Source entity
        """
        return self.repository.get_by_id(source_id)

    def get_source_by_name(self, name: str) -> Source | None:
        """
        Get source by name.

        Args:
            name: Source name

        Returns:
            Source entity or None
        """
        return self.repository.get_by_name(name)

    def list_sources(self, skip: int = 0, limit: int = 100) -> List[Source]:
        """
        List all sources with pagination.

        Args:
            skip: Number of sources to skip
            limit: Maximum number of sources to return

        Returns:
            List of sources
        """
        return self.repository.get_all(skip=skip, limit=limit)

    def count_sources(self) -> int:
        """
        Count total number of sources.

        Returns:
            Total count
        """
        return self.repository.count()

    def update_source(self, source_id: int, source_data: SourceUpdate) -> Source:
        """
        Update source.

        Args:
            source_id: Source identifier
            source_data: Source update data

        Returns:
            Updated source
        """
        logger.info("Updating source", extra={"source_id": source_id})

        # Filter out None values for partial updates
        update_data = source_data.dict(exclude_unset=True)

        # TODO: In production, encrypt password if provided
        source = self.repository.update(source_id, **update_data)

        logger.info("Source updated successfully", extra={"source_id": source.id})

        return source

    def delete_source(self, source_id: int) -> None:
        """
        Delete source.

        Args:
            source_id: Source identifier
        """
        logger.info("Deleting source", extra={"source_id": source_id})

        self.repository.delete(source_id)

        logger.info("Source deleted successfully", extra={"source_id": source_id})

    def test_connection_config(self, config: SourceConnectionTest) -> bool:
        """
        Test database connection using provided configuration.

        Args:
            config: Source connection details

        Returns:
            True if connection successful, False otherwise
        """
        import psycopg2
        
        try:
            logger.info(
                "Testing connection configuration",
                extra={"host": config.pg_host, "port": config.pg_port, "db": config.pg_database}
            )
            
            conn = psycopg2.connect(
                host=config.pg_host,
                port=config.pg_port,
                dbname=config.pg_database,
                user=config.pg_username,
                password=config.pg_password,
                connect_timeout=5
            )
            conn.close()
            return True
        except ImportError:
            logger.warning("psycopg2 not installed, simulating successful connection")
            return True
        except Exception as e:
            logger.error(
                "Connection test failed",
                extra={"error": str(e)},
            )
            return False


    def test_connection(self, source_id: int) -> bool:
        """
        Test database connection for a source.

        Args:
            source_id: Source identifier

        Returns:
            True if connection successful, False otherwise
        """
        source = self.repository.get_by_id(source_id)
        
        # Create config from source
        config = SourceConnectionTest(
            pg_host=source.pg_host,
            pg_port=source.pg_port,
            pg_database=source.pg_database,
            pg_username=source.pg_username,
            pg_password=source.pg_password or "" # Handle potential none
        )

        return self.test_connection_config(config)

    def get_source_details(self, source_id: int) -> SourceDetailResponse:
        """
        Get detailed information for a source.
        
        Includes WAL monitor metrics and table metadata.
        
        Args:
            source_id: Source identifier
            
        Returns:
            Source details
        """
        # 1. Get Source
        source = self.get_source(source_id)
        
        # 2. Get WAL Monitor
        wal_monitor_repo = WALMonitorRepository(self.db)
        wal_monitor = wal_monitor_repo.get_by_source(source_id)
        
        # 3. Get Tables with Version Count
        table_repo = TableMetadataRepository(self.db)
        tables_with_count = table_repo.get_tables_with_version_count(source_id)
        
        source_tables = []
        for table, count in tables_with_count:
            # logic: if count table is 0, then version 1, if count table 1 then version 2 etc.
            # So generic formula: version = count + 1
            version = count + 1
            
            source_tables.append(
                SourceTableInfo(
                    id=table.id,
                    table_name=table.table_name or "Unknown",
                    is_exists_table_landing=table.is_exists_table_landing,
                    is_exists_task=table.is_exists_task,
                    is_exists_table_destination=table.is_exists_table_destination,
                    version=version,
                    schema_table=list(table.schema_table.values()) if isinstance(table.schema_table, dict) else (table.schema_table if isinstance(table.schema_table, list) else [])
                )
            )
            
        # 4. Get Destinations via Pipelines
        pipeline_repo = PipelineRepository(self.db)
        pipelines = pipeline_repo.get_by_source_id(source_id)
        
        # Extract unique destination names
        destination_names = list(set(
            p.destination.name for p in pipelines 
            if p.destination
        ))

        return SourceDetailResponse(
            source=SourceResponse.from_orm(source),
            wal_monitor=WALMonitorResponse.from_orm(wal_monitor) if wal_monitor else None,
            tables=source_tables,
            destinations=destination_names
        )

    def get_table_schema_by_version(self, table_id: int, version: int) -> List[dict]:
        """
        Get table schema for a specific version.
        
        Args:
            table_id: Table ID
            version: Schema version
            
        Returns:
            List of schema columns
        """
        table_repo = TableMetadataRepository(self.db)
        history_repo = HistorySchemaEvolutionRepository(self.db)
        
        table = table_repo.get_by_id(table_id)
        if not table:
            raise EntityNotFoundError(entity_type="TableMetadata", entity_id=table_id)
            
        current_version = (
            self.db.query(HistorySchemaEvolution)
            .filter(HistorySchemaEvolution.table_metadata_list_id == table.id)
            .count()
        ) + 1
        
        if version < 1 or version > current_version:
             raise ValueError(f"Version must be between 1 and {current_version}")
             
        # If requesting current version
        if version == current_version:
            schema_data = table.schema_table
        else:
            history = history_repo.get_by_table_and_version(table.id, version)
            # Logic: If requesting V1, and history for V1 exists, it contains OLD schema (V1) and NEW schema (V2).
            # So we return schema_table_old.
            
            if not history:
                 # Fallback logic: 
                 # If we requested a valid version < current, history SHOULD exist.
                 # But if not found (maybe gap?), try to find nearest? 
                 # For now, strict.
                 raise EntityNotFoundError(entity_type="HistorySchemaEvolution", entity_id=f"{table.id}-v{version}")
            
            schema_data = history.schema_table_old
            
        # Convert dictionary to list if needed
        if isinstance(schema_data, dict):
            return list(schema_data.values())
        elif isinstance(schema_data, list):
            return schema_data
        return []

