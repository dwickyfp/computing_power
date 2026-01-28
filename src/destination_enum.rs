use crate::snowflake::SnowflakeDestination;
use etl::destination::Destination;
use etl::error::EtlResult;
use etl::types::{Event, TableId, TableRow};

#[derive(Clone)]
pub enum DestinationEnum {
    Snowflake(SnowflakeDestination),
}

impl Destination for DestinationEnum {
    fn name() -> &'static str {
        "multi_destination_wrapper"
    }

    async fn truncate_table(&self, table_id: TableId) -> EtlResult<()> {
        match self {
            DestinationEnum::Snowflake(d) => d.truncate_table(table_id).await,
        }
    }

    async fn write_table_rows(&self, table_id: TableId, rows: Vec<TableRow>) -> EtlResult<()> {
        match self {
            DestinationEnum::Snowflake(d) => d.write_table_rows(table_id, rows).await,
        }
    }

    async fn write_events(&self, events: Vec<Event>) -> EtlResult<()> {
        match self {
            DestinationEnum::Snowflake(d) => d.write_events(events).await,
        }
    }
}
