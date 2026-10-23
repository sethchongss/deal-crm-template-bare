-- Read-only checks for 20261003160000_audit_source.sql.
-- Does not modify data. Run after the migration.

SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'audit_log'
  AND column_name IN ('source', 'actor_label')
ORDER BY column_name;

SELECT conname
FROM pg_constraint
WHERE conrelid = 'public.audit_log'::regclass
  AND conname IN ('audit_log_source_check', 'audit_log_actor_label_check')
ORDER BY conname;

SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname = 'audit_log_claude_created_idx';

SELECT
  position('x-crm-source' IN pg_get_functiondef('private.audit_row()'::regprocedure)) > 0 AS trigger_reads_source_header,
  position('app.source' IN pg_get_functiondef('private.audit_row()'::regprocedure)) > 0 AS trigger_reads_set_config;

SELECT
  has_function_privilege('authenticated', 'public.undo_claude_change(uuid)', 'execute') AS team_can_call_undo,
  has_function_privilege('anon', 'public.undo_claude_change(uuid)', 'execute') AS anon_can_call_undo;

-- Existing rows are not rewritten: both new columns are null until a new write arrives.
SELECT count(*) FILTER (WHERE source IS NOT NULL) AS tagged_rows,
       count(*) AS audit_rows
FROM public.audit_log;
