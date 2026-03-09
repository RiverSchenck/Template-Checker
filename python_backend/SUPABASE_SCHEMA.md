# Supabase Database Schema for Analytics and Access

This document describes the database schema for analytics tracking and for **invite-only access** (users and access requests).

## Tables

### `users` table (approved users and roles)

Single source of truth for who can sign in and their role. Replaces the previous use of `profiles` and `allowed_users` for access control.

| Column          | Type        | Description |
|-----------------|-------------|-------------|
| `id`            | uuid        | Primary key (used in admin API for PATCH/DELETE). |
| `email`         | text        | UNIQUE NOT NULL, lowercase. Used to match on sign-in (JWT email). |
| `role`          | text        | NOT NULL DEFAULT 'user', CHECK (role IN ('user', 'admin')). |
| `display_name`  | text        | Optional. Synced from Auth user_metadata on sign-in. |
| `avatar_url`    | text        | Optional. Synced from Auth user_metadata on sign-in. |
| `auth_user_id`  | uuid        | Nullable, FK → auth.users(id) ON DELETE SET NULL. Set when user first signs in; null for invited but not yet signed in. |
| `approved_by`   | uuid        | Nullable, FK → users(id) ON DELETE SET NULL. Admin who approved/invited this user. |
| `created_at`    | timestamptz | DEFAULT now(). |
| `updated_at`    | timestamptz | DEFAULT now(). |

**Bootstrap first admin**: Run `INSERT INTO users (email, role) VALUES ('your-email@example.com', 'admin');` once. That user can then sign in with Google and manage invites/access requests.

**RLS**: Enabled. No policies for anon/authenticated—only the service role (backend) can access. Frontend does not query this table.

### `access_requests` table (request access flow)

Stores people who requested access but are not yet approved. When an admin approves, a row is added to `users` and the request status is updated.

| Column       | Type        | Description |
|-------------|-------------|-------------|
| `id`        | uuid        | Primary key. |
| `email`     | text        | NOT NULL. |
| `status`    | text        | NOT NULL, CHECK (status IN ('pending', 'approved', 'rejected')). |
| `created_at`| timestamptz | DEFAULT now(). |
| `updated_at`| timestamptz | DEFAULT now(). |
| `decided_by`| uuid        | Nullable, FK → auth.users(id). Admin who approved/rejected. |

**RLS**: Enabled. No policies for anon/authenticated—only the service role (backend) can access.

### `profiles` table (legacy, not used for access)

This table is **no longer used** for access or role. The app uses the `users` table instead. You can leave the table in place or drop it in a future migration.

### `runs` table

Stores high-level information about each validation run.

| Column            | Type                                 | Description                                                      |
| ----------------- | ------------------------------------ | ---------------------------------------------------------------- |
| `id`              | `uuid` (primary key, auto-generated) | Unique run identifier                                            |
| `timestamp`       | `timestamptz`                        | When the run occurred (UTC)                                      |
| `template_name`   | `text`                               | Name of the template being validated                             |
| `source_type`     | `text`                               | Source of request: `'react-frontend'`, `'extension'`, or `'api'` |
| `duration_ms`     | `integer`                            | Duration of validation in milliseconds                           |
| `file_size_bytes` | `bigint`                             | Size of uploaded file in bytes                                   |
| `total_errors`    | `integer`                            | Total number of errors found                                     |
| `total_warnings`  | `integer`                            | Total number of warnings found                                   |
| `total_infos`     | `integer`                            | Total number of info messages                                    |

### `validations` table

Stores each individual error, warning, or info found during validation. This allows for detailed analytics on specific issues.

**Note on size**: Each validation record is approximately 200-500 bytes. With 100 validations per template and 1000 runs per day, this equals ~20-50MB/day or ~7-18GB/year, which is easily manageable for PostgreSQL/Supabase.

| Column            | Type                                 | Description                                                                                   |
| ----------------- | ------------------------------------ | --------------------------------------------------------------------------------------------- |
| `id`              | `uuid` (primary key, auto-generated) | Unique validation identifier                                                                  |
| `run_id`          | `uuid` (foreign key → `runs.id`)     | Reference to the run                                                                          |
| `validation_type` | `text`                               | Validation type (e.g., `'PARAGRAPH_STYLE'`, `'HYPHENATION'`, `'EMBEDDED_IMAGE'`)              |
| `severity`        | `text`                               | Severity level: `'error'`, `'warning'`, or `'info'`                                           |
| `category`        | `text`                               | Category: `'par_styles'`, `'char_styles'`, `'text_boxes'`, `'fonts'`, `'images'`, `'general'` |
| `identifier`      | `text`                               | Identifier (e.g., story_id, font name, style name)                                            |
| `created_at`      | `timestamptz`                        | When the validation was recorded (defaults to NOW())                                          |

## SQL to Create Tables

For `users` and `access_requests`, use the migration file `migrations/001_users_and_access_requests.sql`. Below: runs, validations, and legacy profiles (optional).
CREATE TABLE runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    template_name TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('react-frontend', 'extension', 'api')),
    duration_ms INTEGER NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    total_errors INTEGER NOT NULL DEFAULT 0,
    total_warnings INTEGER NOT NULL DEFAULT 0,
    total_infos INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Create validations table
CREATE TABLE validations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    validation_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('error', 'warning', 'info')),
    category TEXT NOT NULL CHECK (category IN ('par_styles', 'char_styles', 'text_boxes', 'fonts', 'images', 'general')),
    identifier TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_runs_timestamp ON runs(timestamp);
CREATE INDEX idx_runs_template_name ON runs(template_name);
CREATE INDEX idx_runs_source_type ON runs(source_type);
CREATE INDEX idx_runs_user_id ON runs(user_id);
CREATE INDEX idx_validations_run_id ON validations(run_id);
CREATE INDEX idx_validations_validation_type ON validations(validation_type);
CREATE INDEX idx_validations_severity ON validations(severity);
CREATE INDEX idx_validations_category ON validations(category);
CREATE INDEX idx_validations_template_name ON validations(run_id) INCLUDE (validation_type, severity);
```

## Environment Variables

Set these environment variables in your deployment:

- `SUPABASE_URL`: Your Supabase project URL (e.g., `https://xxxxx.supabase.co`). Used for API access and for JWT verification via the JWKS endpoint (no secret needed when using Supabase’s JWT Signing keys).
- `SUPABASE_KEY`: Your Supabase service role key (for backend access)
- `SUPABASE_JWT_SECRET`: (optional) Legacy JWT secret for verifying user tokens. Not needed if your project uses the new JWT Signing keys—the backend verifies tokens using the public JWKS from `SUPABASE_URL/auth/v1/.well-known/jwks.json`.

Access control is handled by the `users` table. Bootstrap the first admin with: `INSERT INTO users (email, role) VALUES ('your-email@example.com', 'admin');`

## Example Queries

### Get all runs with validation counts

```sql
SELECT
    r.*,
    COUNT(v.id) as validation_count
FROM runs r
LEFT JOIN validations v ON r.id = v.run_id
GROUP BY r.id
ORDER BY r.timestamp DESC;
```

### Get most common validation issues

```sql
SELECT
    validation_type,
    severity,
    COUNT(*) as total_count
FROM validations
GROUP BY validation_type, severity
ORDER BY total_count DESC
LIMIT 20;
```

### Get runs by source type with average validations

```sql
SELECT
    r.source_type,
    COUNT(DISTINCT r.id) as run_count,
    AVG(r.duration_ms) as avg_duration_ms,
    AVG(r.total_errors) as avg_errors,
    AVG(r.total_warnings) as avg_warnings,
    COUNT(v.id) as total_validations
FROM runs r
LEFT JOIN validations v ON r.id = v.run_id
GROUP BY r.source_type;
```

### Get validations for a specific template

```sql
SELECT
    v.*,
    r.template_name,
    r.timestamp
FROM validations v
JOIN runs r ON v.run_id = r.id
WHERE r.template_name = 'YourTemplateName'
ORDER BY r.timestamp DESC, v.severity, v.validation_type;
```

### Get validation trends over time

```sql
SELECT
    DATE_TRUNC('day', r.timestamp) as date,
    v.validation_type,
    v.severity,
    COUNT(*) as count
FROM validations v
JOIN runs r ON v.run_id = r.id
WHERE r.timestamp >= NOW() - INTERVAL '30 days'
GROUP BY date, v.validation_type, v.severity
ORDER BY date DESC, count DESC;
```

## Data Retention & Archiving

If you need to manage data growth over time, consider:

1. **Partitioning by date**: Partition the `validations` table by month/year
2. **Archiving old data**: Move data older than X months to an archive table
3. **Aggregation**: Keep detailed data for recent runs, aggregate older data into summary tables

Example archiving strategy:

```sql
-- Create archive table (same structure as validations)
CREATE TABLE validations_archive (LIKE validations INCLUDING ALL);

-- Archive validations older than 1 year
INSERT INTO validations_archive
SELECT * FROM validations
WHERE created_at < NOW() - INTERVAL '1 year';

-- Delete archived validations
DELETE FROM validations
WHERE created_at < NOW() - INTERVAL '1 year';
```
