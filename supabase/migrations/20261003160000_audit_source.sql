-- Tag audit rows that came from Claude, and allow the team to undo those rows.
-- Additive: two nullable columns and a replace of the existing audit trigger function.
-- Does not update, insert, or delete any deal, partner, task, or activity row.
-- Existing audit rows stay, with source and actor_label left null.
-- Requires 20261003120000_lockdown.sql.

ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS actor_label text;

ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_source_check;
ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_log_source_check
  CHECK (source IS NULL OR source IN ('claude', 'web'));

ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_actor_label_check;
ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_log_actor_label_check
  CHECK (
    actor_label IS NULL
    OR actor_label IN ('Member 1', 'Member 2', 'Member 3')
  );

CREATE INDEX IF NOT EXISTS audit_log_claude_created_idx
  ON public.audit_log (created_at DESC)
  WHERE source = 'claude';

-- The connector sends x-crm-source and x-crm-actor on each PostgREST
-- request. Those headers are visible as request.headers inside this trigger,
-- which runs in the same transaction as the write. A transaction-local
-- set_config('app.source', ...) / set_config('app.actor_label', ...) is also
-- honoured when the header is absent. Invalid values are stored as null so a
-- bad header cannot fail the write.
CREATE OR REPLACE FUNCTION private.audit_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  payload jsonb;
  row_pk uuid;
  headers jsonb;
  raw_source text;
  raw_actor text;
  source_value text;
  actor_value text;
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

  BEGIN
    headers := COALESCE(NULLIF(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  EXCEPTION
    WHEN others THEN
      headers := '{}'::jsonb;
  END;

  raw_source := lower(btrim(COALESCE(
    NULLIF(current_setting('app.source', true), ''),
    headers->>'x-crm-source',
    ''
  )));
  IF raw_source = 'claude' OR raw_source = 'web' THEN
    source_value := raw_source;
  ELSE
    source_value := NULL;
  END IF;

  raw_actor := btrim(COALESCE(
    NULLIF(current_setting('app.actor_label', true), ''),
    headers->>'x-crm-actor',
    ''
  ));
  actor_value := CASE lower(raw_actor)
    WHEN 'member 1' THEN 'Member 1'
    WHEN 'member 2' THEN 'Member 2'
    WHEN 'member 3' THEN 'Member 3'
    ELSE NULL
  END;

  INSERT INTO public.audit_log (table_name, row_id, action, old_values, new_values, source, actor_label)
  VALUES (
    TG_TABLE_NAME,
    row_pk,
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    source_value,
    actor_value
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.audit_row() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.undo_claude_change(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  entry public.audit_log%ROWTYPE;
  col text;
  cols text[] := ARRAY[]::text[];
  col_list text;
  val_list text;
  affected integer;
BEGIN
  IF NOT private.is_team() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  SELECT * INTO entry FROM public.audit_log WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'audit entry not found';
  END IF;
  IF entry.source IS DISTINCT FROM 'claude' THEN
    RAISE EXCEPTION 'only changes made via Claude can be undone';
  END IF;
  IF entry.table_name NOT IN (
    'deals', 'deal_activities', 'deal_partners', 'deal_workstreams',
    'deal_tasks', 'partners', 'partner_notes', 'deal_stage_history'
  ) THEN
    RAISE EXCEPTION 'this table cannot be undone';
  END IF;
  IF entry.row_id IS NULL THEN
    RAISE EXCEPTION 'audit entry has no row id';
  END IF;

  IF entry.action = 'INSERT' THEN
    EXECUTE format('DELETE FROM public.%I WHERE id = $1', entry.table_name) USING entry.row_id;
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected = 0 THEN
      RAISE EXCEPTION 'That row is already gone.';
    END IF;
    RETURN jsonb_build_object('undone', true, 'reversal', 'delete', 'table', entry.table_name, 'row_id', entry.row_id);
  END IF;

  IF entry.action = 'DELETE' THEN
    IF entry.old_values IS NULL THEN
      RAISE EXCEPTION 'Nothing to restore.';
    END IF;
    EXECUTE format(
      'INSERT INTO public.%I SELECT (jsonb_populate_record(NULL::public.%I, $1)).*',
      entry.table_name,
      entry.table_name
    ) USING entry.old_values;
    RETURN jsonb_build_object('undone', true, 'reversal', 'insert', 'table', entry.table_name, 'row_id', entry.row_id);
  END IF;

  IF entry.action <> 'UPDATE' OR entry.old_values IS NULL OR entry.new_values IS NULL THEN
    RAISE EXCEPTION 'This audit entry cannot be undone.';
  END IF;

  FOR col IN SELECT jsonb_object_keys(entry.old_values)
  LOOP
    IF col IN ('id', 'updated_at') THEN
      CONTINUE;
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = entry.table_name
        AND column_name = col
    ) THEN
      CONTINUE;
    END IF;
    IF (entry.old_values -> col) IS NOT DISTINCT FROM (entry.new_values -> col) THEN
      CONTINUE;
    END IF;
    cols := array_append(cols, col);
  END LOOP;

  IF coalesce(array_length(cols, 1), 0) = 0 THEN
    RETURN jsonb_build_object('undone', true, 'reversal', 'noop', 'table', entry.table_name, 'row_id', entry.row_id);
  END IF;

  SELECT string_agg(format('%I', item), ', '), string_agg(format('r.%I', item), ', ')
  INTO col_list, val_list
  FROM unnest(cols) AS item;

  EXECUTE format(
    'UPDATE public.%I AS t SET (%s) = (SELECT %s FROM jsonb_populate_record(NULL::public.%I, $2) AS r) WHERE t.id = $1',
    entry.table_name,
    col_list,
    val_list,
    entry.table_name
  ) USING entry.row_id, entry.old_values;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected = 0 THEN
    RAISE EXCEPTION 'That row is no longer there.';
  END IF;

  RETURN jsonb_build_object(
    'undone', true,
    'reversal', 'update',
    'table', entry.table_name,
    'row_id', entry.row_id,
    'fields', to_jsonb(cols)
  );
END;
$$;

REVOKE ALL ON FUNCTION private.undo_claude_change(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.undo_claude_change(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.undo_claude_change(p_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.undo_claude_change(p_id);
$$;

REVOKE ALL ON FUNCTION public.undo_claude_change(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.undo_claude_change(uuid) TO authenticated;
