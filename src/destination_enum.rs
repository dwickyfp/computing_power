use etl::destination::Destination;
use etl::error::EtlResult;
use etl::types::{Event, TableId, TableRow};
use std::sync::Arc;

use crate::postgres::destination::PostgresDuckdbDestination;
use crate::snowflake::SnowflakeDestination;

#[derive(Clone)]
pub enum DestinationEnum {
    Snowflake(SnowflakeDestination),
    Postgres(PostgresDuckdbDestination),
    Multi(Arc<Vec<Box<DestinationEnum>>>),
}

#[allow(refining_impl_trait)]
impl Destination for DestinationEnum {
    fn name() -> &'static str {
        "multi_destination_wrapper"
    }

    fn truncate_table(
        &self,
        table_id: TableId,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = EtlResult<()>> + Send + '_>> {
        Box::pin(async move {
            match self {
                DestinationEnum::Snowflake(d) => d.truncate_table(table_id).await,
                DestinationEnum::Postgres(d) => d.truncate_table(table_id).await,
                DestinationEnum::Multi(dests) => {
                    let mut handles = vec![];
                    for dest in dests.iter() {
                        let dest = dest.clone();
                        let tid = table_id.clone();
                        handles.push(tokio::spawn(async move { dest.truncate_table(tid).await }));
                    }

                    for h in handles {
                        match h.await {
                            Ok(res) => res?,
                            Err(e) => {
                                return Err((
                                    etl::error::ErrorKind::Unknown,
                                    "Join Error",
                                    e.to_string(),
                                )
                                    .into());
                            }
                        }
                    }
                    Ok(())
                }
            }
        })
    }

    fn write_table_rows(
        &self,
        table_id: TableId,
        rows: Vec<TableRow>,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = EtlResult<()>> + Send + '_>> {
        Box::pin(async move {
            match self {
                DestinationEnum::Snowflake(d) => d.write_table_rows(table_id, rows).await,
                DestinationEnum::Postgres(d) => d.write_table_rows(table_id, rows).await,
                DestinationEnum::Multi(dests) => {
                    let mut handles = vec![];
                    for dest in dests.iter() {
                        let dest = dest.clone();
                        let tid = table_id.clone();
                        let r = rows.clone();
                        handles.push(tokio::spawn(
                            async move { dest.write_table_rows(tid, r).await },
                        ));
                    }

                    for h in handles {
                        match h.await {
                            Ok(res) => res?,
                            Err(e) => {
                                return Err((
                                    etl::error::ErrorKind::Unknown,
                                    "Join Error",
                                    e.to_string(),
                                )
                                    .into());
                            }
                        }
                    }
                    Ok(())
                }
            }
        })
    }

    fn write_events(
        &self,
        events: Vec<Event>,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = EtlResult<()>> + Send + '_>> {
        Box::pin(async move {
            match self {
                DestinationEnum::Snowflake(d) => d.write_events(events).await,
                DestinationEnum::Postgres(d) => d.write_events(events).await,
                DestinationEnum::Multi(dests) => {
                    let mut handles = vec![];
                    for dest in dests.iter() {
                        let dest = dest.clone();
                        let evs = events.clone();
                        handles.push(tokio::spawn(async move { dest.write_events(evs).await }));
                    }

                    for h in handles {
                        match h.await {
                            Ok(res) => res?,
                            Err(e) => {
                                return Err((
                                    etl::error::ErrorKind::Unknown,
                                    "Join Error",
                                    e.to_string(),
                                )
                                    .into());
                            }
                        }
                    }
                    Ok(())
                }
            }
        })
    }
}
