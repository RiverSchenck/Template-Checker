# Supabase Database Schema for Analytics

This document describes the database schema needed for analytics tracking.

## Tables

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

```sql
-- Create runs table
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
    created_at TIMESTAMPTZ DEFAULT NOW()
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
CREATE INDEX idx_validations_run_id ON validations(run_id);
CREATE INDEX idx_validations_validation_type ON validations(validation_type);
CREATE INDEX idx_validations_severity ON validations(severity);
CREATE INDEX idx_validations_category ON validations(category);
CREATE INDEX idx_validations_template_name ON validations(run_id) INCLUDE (validation_type, severity);
```

## Environment Variables

Set these environment variables in your deployment:

- `SUPABASE_URL`: Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
- `SUPABASE_KEY`: Your Supabase service role key (for backend access)

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
