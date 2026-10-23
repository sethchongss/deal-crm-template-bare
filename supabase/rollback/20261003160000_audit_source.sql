-- Reverse 20261003160000_audit_source.sql.
-- Restores the previous audit trigger function and drops the new columns.
-- Does not delete audit rows or any deal data. source and actor_label values are dropped with the columns.

DROP FUNCTION IF EXISTS public.undo_claude_change(uuid);
DROP FUNCTION IF EXISTS private.undo_claude_change(uuid);

CREATE OR REPLACE FUNCTION private.audit_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  payload jsonb;
  row_pk uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    payload := to_jsonb(OLD);
  ELSE
    payload := to_jsonb(NEW);
  END IF;

  BEGIN
    row_pk := NULLIF(payload->>'id', '')::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      row_pk := NULL;
  END;

  INSERT INTO public.audit_log (table_name, row_id, action, old_values, new_values)
  VALUES (
    TG_TABLE_NAME,
    row_pk,
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.audit_row() FROM PUBLIC, anon, authenticated;

DROP INDEX IF EXISTS public.audit_log_claude_created_idx;
ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_actor_label_check;
ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_source_check;
ALTER TABLE public.audit_log DROP COLUMN IF EXISTS actor_label;
ALTER TABLE public.audit_log DROP COLUMN IF EXISTS source;
