# Error Message Sanitization - Security Update

## Overview

Implemented comprehensive error message sanitization throughout the compute engine to prevent exposure of sensitive credentials and connection details in database error logs and user notifications.

## Problem

Previously, raw exception messages were stored directly in database tables (`pipelines_destination`, `pipeline_metadata`, `notification_log`), potentially exposing:

- Database passwords
- Connection strings with embedded credentials
- API keys and tokens
- Private keys
- Authentication details

## Solution

Created a centralized `ErrorSanitizer` class that:

1. **Removes sensitive patterns** (passwords, tokens, connection strings)
2. **Maps technical errors to user-friendly messages**
3. **Provides context-aware sanitization** for different destinations
4. **Maintains security across logs, database, and UI**

## Files Created

### `core/error_sanitizer.py`

Comprehensive error sanitization utility with three main functions:

```python
# For database storage (most aggressive sanitization)
sanitize_for_db(error, destination_name, destination_type)

# For application logs (sanitizes credentials, keeps structure)
sanitize_for_log(error, include_details=True)

# General purpose sanitization
sanitize_error(error, context)
```

## Files Modified

### 1. `core/engine.py`

**Changes:**

- Import `sanitize_for_db`, `sanitize_for_log`
- Sanitize destination initialization errors before storing to DB
- Sanitize pipeline execution errors

**Before:**

```python
error_msg = f"Failed to initialize destination {name}: {str(e)}"
PipelineDestinationRepository.update_error(pd.id, True, error_msg)
```

**After:**

```python
log_msg = f"Failed to initialize destination {name}: {sanitize_for_log(e)}"
db_error_msg = sanitize_for_db(e, name, dest_type)
PipelineDestinationRepository.update_error(pd.id, True, db_error_msg)
```

### 2. `core/event_handler.py`

**Changes:**

- Import `sanitize_for_db`, `sanitize_for_log`
- Sanitize destination write errors (both `DestinationException` and general exceptions)
- Sanitized messages used in:
  - Database error storage
  - DLQ enqueue
  - Notification creation

**Before:**

```python
error_msg = f"Destination error: {str(e)}"
TableSyncRepository.update_error(id, True, error_msg)
```

**After:**

```python
log_msg = f"Destination error: {sanitize_for_log(e)}"
db_error_msg = sanitize_for_db(e, dest_name, dest_type)
TableSyncRepository.update_error(id, True, db_error_msg)
```

### 3. `destinations/postgresql.py`

**Changes:**

- Import `sanitize_for_db`
- Sanitize PostgreSQL initialization errors

**Before:**

```python
raise DestinationException(
    f"Failed to initialize PostgreSQL destination: {e}",
    {"destination_id": self._config.id}
)
```

**After:**

```python
sanitized_msg = sanitize_for_db(e, self._config.name, "POSTGRES")
raise DestinationException(
    sanitized_msg,
    {"destination_id": self._config.id}
)
```

### 4. `destinations/snowflake/destination.py`

**Changes:**

- Import `sanitize_for_db`
- Sanitize Snowflake initialization and configuration errors
- Generic messages for missing config fields

**Before:**

```python
raise DestinationException(
    f"Missing required Snowflake config: {missing}",
    {"destination_id": self._config.id}
)
```

**After:**

```python
raise DestinationException(
    "Missing required Snowflake configuration fields",
    {"destination_id": self._config.id}
)
```

## Error Message Mappings

### Connection Errors

| Technical Error          | User-Friendly Message         |
| ------------------------ | ----------------------------- |
| `connection refused`     | Database Connection Refused   |
| `connection timed out`   | Database Connection Timeout   |
| `connection closed`      | Database Connection Closed    |
| `could not connect`      | Unable to Connect to Database |
| `network is unreachable` | Network Connection Failed     |

### Authentication Errors

| Technical Error         | User-Friendly Message          |
| ----------------------- | ------------------------------ |
| `authentication failed` | Database Authentication Failed |
| `access denied`         | Database Access Denied         |
| `permission denied`     | Database Permission Denied     |
| `invalid password`      | Database Authentication Failed |
| `login failed`          | Database Login Failed          |

### Schema Errors

| Technical Error           | User-Friendly Message                          |
| ------------------------- | ---------------------------------------------- |
| `table does not exist`    | Target table not found in destination          |
| `relation does not exist` | Target table not found in destination          |
| `column does not exist`   | Column mismatch between source and destination |

## Sensitive Pattern Removal

The sanitizer automatically removes:

### 1. **Connection Strings**

```
Before: postgresql://user:SecretPass123@host:5432/db
After:  postgresql://***:***@host:5432/db
```

### 2. **Passwords**

```
Before: password='MySecretPass'
After:  password=***
```

### 3. **API Keys & Tokens**

```
Before: api_key='sk_live_12345abcdef'
After:  api_key=***
```

### 4. **Private Keys**

```
Before: -----BEGIN PRIVATE KEY----- MIIEvQ... -----END PRIVATE KEY-----
After:  -----BEGIN PRIVATE KEY----- [REDACTED] -----END PRIVATE KEY-----
```

## Example Transformations

### PostgreSQL Connection Error

**Before (Exposed):**

```
Failed to initialize PostgreSQL destination:
could not connect to server: Connection refused
postgresql://prod_user:SuperSecret123@10.0.1.50:5432/production_db
```

**After (Sanitized):**

```
Database Connection Refused
```

### Snowflake Authentication Error

**Before (Exposed):**

```
Failed to initialize Snowflake destination:
JWT token generation failed: private key 'user_private_key.pem'
with passphrase 'MyKeyPass123' could not be loaded
```

**After (Sanitized):**

```
Snowflake Authentication Error
```

### PostgreSQL Schema Error

**Before (Technical):**

```
relation "public.unknown_table" does not exist
```

**After (User-Friendly):**

```
Target table not found in destination
```

## Database Tables Protected

Error sanitization now applied to:

1. **`pipelines_destination`**
   - Column: `error_message`
   - Used by: Destination initialization, write operations

2. **`pipeline_metadata`**
   - Column: `error_message`
   - Used by: Pipeline execution status

3. **`pipeline_destination_table_sync`**
   - Column: `error_message`
   - Used by: Table sync operations

4. **`notification_log`**
   - Column: `message`
   - Used by: User notifications

## Security Benefits

✅ **Credentials Protected**: Passwords, tokens, keys never stored in database  
✅ **User-Friendly**: Clear messages instead of technical jargon  
✅ **Compliance**: Helps meet security audit requirements  
✅ **Log Safety**: Detailed logs for admins, safe messages for DB  
✅ **DLQ Safe**: Sanitized messages in dead letter queue  
✅ **Notification Safe**: User notifications contain no sensitive data

## Logging Behavior

### Application Logs (for admins)

- Credentials sanitized but structure preserved
- Full stack traces available
- More technical detail for debugging

### Database Storage (for users/UI)

- Most aggressive sanitization
- User-friendly messages
- No technical implementation details

### Example:

```python
# Application log (admin only)
logger.error("Failed: postgresql://***:***@10.0.1.50:5432/db connection refused")

# Database storage (visible to users)
"Database Connection Refused"
```

## Testing

Test the sanitization:

```python
from core.error_sanitizer import sanitize_for_db, sanitize_for_log

# Test connection error
try:
    import psycopg2
    psycopg2.connect("postgresql://user:pass@host/db")
except Exception as e:
    print("Log:", sanitize_for_log(e))
    print("DB:", sanitize_for_db(e, "MyDB", "POSTGRES"))
```

## Monitoring

Check that errors are sanitized:

```sql
-- Check destination errors (should not contain passwords)
SELECT error_message
FROM pipelines_destination
WHERE is_error = TRUE
AND error_message ILIKE '%password%';
-- Should return no results

-- Check for exposed credentials patterns
SELECT error_message
FROM notification_log
WHERE message ~ '[a-zA-Z0-9]{20,}';
-- Review for any long strings that might be tokens
```

## Backward Compatibility

✅ **No breaking changes** - same API signatures  
✅ **Existing error handling preserved**  
✅ **Additional safety layer only**

## Future Enhancements

Potential improvements:

- [ ] Add more error type mappings for specific databases
- [ ] Configurable sanitization levels (strict/moderate/minimal)
- [ ] Sanitization metrics/monitoring
- [ ] Regex pattern configuration via settings
- [ ] Multi-language error messages
- [ ] Audit log of sanitized vs original errors (secure storage)

## Security Notes

⚠️ **Application logs still need protection**  
While error messages are sanitized for database storage, application log files may still contain sensitive information. Ensure:

- Log files have restricted file system permissions
- Log rotation configured
- Logs not accessible via web
- Consider log aggregation with access controls

## Conclusion

All error messages stored in the database and shown to users are now sanitized to prevent credential exposure. This improves security posture while maintaining usability and debuggability for administrators.
