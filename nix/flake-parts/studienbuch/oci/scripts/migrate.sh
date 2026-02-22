#!/bin/sh

set -eu

if [ -z "${MANAGEMENT_DATABASE_URL:-}" ]; then
  echo "MANAGEMENT_DATABASE_URL is not set" >&2
  exit 1
fi

journal_path="/app/packages/db/drizzle/meta/_journal.json"
if [ ! -f "$journal_path" ]; then
  echo "Missing drizzle journal at $journal_path" >&2
  exit 1
fi

psql_bin="$(command -v psql)"
jq_bin="$(command -v jq)"

"$psql_bin" "$MANAGEMENT_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE SCHEMA IF NOT EXISTS stu_internal;
CREATE TABLE IF NOT EXISTS stu_internal.migrations (
  tag text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL

"$jq_bin" -r '.entries | sort_by(.idx) | .[].tag' "$journal_path" | while IFS= read -r tag; do
  sql_path="/app/packages/db/drizzle/$tag.sql"
  if [ ! -f "$sql_path" ]; then
    echo "Missing migration SQL file: $sql_path" >&2
    exit 1
  fi

  already_applied=$("$psql_bin" "$MANAGEMENT_DATABASE_URL" -tA -v ON_ERROR_STOP=1 \
    -c "SELECT 1 FROM stu_internal.migrations WHERE tag = '$tag' LIMIT 1;")
  if [ "$already_applied" = "1" ]; then
    echo "Skipping already applied migration: $tag"
    continue
  fi

  echo "Applying migration: $tag"
  "$psql_bin" "$MANAGEMENT_DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
BEGIN;
\i $sql_path
INSERT INTO stu_internal.migrations(tag) VALUES ('$tag');
COMMIT;
SQL
done

echo "Migrations completed."
