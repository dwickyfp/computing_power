# Rosetta

Rosetta is a high-performance, real-time ETL engine written in Rust. It captures data changes from a **PostgreSQL** database using Logical Replication (CDC - Change Data Capture) and streams them efficiently to **Snowflake**.

Designed for speed and reliability, Rosetta leverages the `etl` framework to handle the replication stream and ensures secure data ingestion into Snowflake using Key-Pair Authentication.

## Project Flow

The data flows through the system in real-time:

1.  **Source (PostgreSQL)**: Rosetta connects to a PostgreSQL database and listens to a logical replication slot. Any changes (INSERT, UPDATE, DELETE) are captured immediately from the WAL (Write-Ahead Log).
2.  **Processing (Rosetta/Rust)**: The Rust application processes these change events. It handles data conversion and batching to optimize throughput.
3.  **Authentication**: Rosetta uses Key-Pair Authentication (RSA) to securely connect to Snowflake. It supports encrypted private keys (PKCS#8) for enhanced security.
4.  **Destination (Snowflake)**: The processed data is ingested into the specified Snowflake table (Landing Table).

## System Architecture

Rosetta is driven by a configuration database. You define your sources, destinations, and pipelines in PostgreSQL tables, and the application dynamically manages them.

The system schema matches `migrations/001_create_table.sql`:

*   **sources**: PostgreSQL connection configurations.
*   **destinations**: Snowflake connection capabilities.
*   **pipelines**: Active data streams linking a source to a destination.
*   **pipeline_metadata**: Runtime status and health metrics.

## How to Run

### Prerequisites

*   [Rust](https://www.rust-lang.org/tools/install) (latest stable)
*   [Docker](https://www.docker.com/) & Docker Compose (for running the local PostgreSQL instance)
*   OpenSSL (for generating keys)

### Step 1: Generate Private & Public Keys

Rosetta uses Key-Pair Authentication for Snowflake.

1.  **Generate Encrypted Private Key** (remember the passphrase):
    ```bash
    openssl genrsa 2048 | openssl pkcs8 -topk8 -inform PEM -out rsa_key.p8 -v2 des3 -out rsa_key.p8
    ```
2.  **Generate Public Key**:
    ```bash
    openssl rsa -in rsa_key.p8 -pubout -out rsa_key.pub
    ```
3.  **Configure Snowflake User**:
    ```sql
    ALTER USER <YOUR_USER> SET RSA_PUBLIC_KEY='<CONTENT_OF_RSA_KEY_PUB>';
    ```

### Step 2: Set Environment Variables

Create a `.env` file in the root directory. Since Rosetta loads configuration from the database, you only need to provide the connection string to your *Configuration Database* and the log level.

```bash
# Logging
RUST_LOG=info

# Configuration Database URL
# This is the Postgres DB where `sources`, `destinations`, etc. tables are located.
CONFIG_DATABASE_URL=postgres://postgres:postgres@localhost:5433/postgres
```

### Step 3: Populate Configuration

Before running the app, you must insert your connection details into the configuration tables.

You can interpret `migrations/002_seed_data.sql` as a template.

**1. Add a Source (Postgres)**
```sql
INSERT INTO sources (name, pg_host, pg_port, pg_database, pg_username, pg_password, publication_name, replication_id)
VALUES ('my_postgres', 'localhost', 5432, 'mydb', 'user', 'pass', 'my_pub', 1);
```

**2. Add a Destination (Snowflake)**
```sql
INSERT INTO destinations (name, snowflake_account, snowflake_user, snowflake_db, snowflake_schema, snowflake_role, snowflake_private_key_path, snowflake_private_key_passphrase)
VALUES ('my_snowflake', 'xy12345', 'etl_user', 'DW', 'LANDING', 'ETL_ROLE', '/path/to/rsa_key.p8', 'passphrase');
```

**3. Create a Pipeline**
```sql
INSERT INTO pipelines (name, source_id, destination_id, status)
VALUES ('LANDING_USERS', 1, 1, 'START');
```

### Step 4: Run Rosetta

Start the local database (if using Docker) and run the application:

```bash
docker-compose up -d
cargo run
```

The application will connect to the `CONFIG_DATABASE_URL`, apply necessary migrations automatically, and start any pipelines marked as `START`.

## Pipeline Management

Rosetta listens for changes in the `pipelines` table. You can control streams in real-time using SQL:

*   **Stop a Pipeline**: `UPDATE pipelines SET status = 'PAUSE' WHERE name = '...';`
*   **Resume/Start**: `UPDATE pipelines SET status = 'START' WHERE name = '...';`
*   **Force Restart**: `UPDATE pipelines SET status = 'REFRESH' WHERE name = '...';`

Check `pipeline_metadata` for errors and status:
```sql
SELECT * FROM pipeline_metadata;
```
