-- Run AFTER the Stage 2 migrations.
-- For a before/after digest of the original columns, use original_checksums.sql.
-- That file does not mention the new tables, so it runs on the current production schema.

-- Row counts. The four original tables must match the pre-migration counts.
SELECT 'deals' AS table_name, count(*) AS rows FROM public.deals
UNION ALL SELECT 'deal_activities', count(*) FROM public.deal_activities
UNION ALL SELECT 'partners', count(*) FROM public.partners
UNION ALL SELECT 'realized_deals', count(*) FROM public.realized_deals
UNION ALL SELECT 'deal_stage_history', count(*) FROM public.deal_stage_history
UNION ALL SELECT 'sector_group_map', count(*) FROM public.sector_group_map
UNION ALL SELECT 'deal_partners', count(*) FROM public.deal_partners
UNION ALL SELECT 'partner_notes', count(*) FROM public.partner_notes
UNION ALL SELECT 'deal_workstreams', count(*) FROM public.deal_workstreams
UNION ALL SELECT 'deal_tasks', count(*) FROM public.deal_tasks
ORDER BY table_name;

SELECT 'deals_original' AS checksum, md5(string_agg(md5(payload::text), '' ORDER BY id::text)) AS digest
FROM (
  SELECT id, jsonb_build_object(
    'id', id,
    'company_name', company_name,
    'tier', tier,
    'sort_order', sort_order,
    'source', source,
    'source_type', source_type,
    'source_contact', source_contact,
    'sector', sector,
    'country', country,
    'company_description', company_description,
    'latest_context', latest_context,
    'owners', owners,
    'other_info', other_info,
    'latest_sales', latest_sales,
    'latest_ebitda', latest_ebitda,
    'net_debt_cash', net_debt_cash,
    'financial_comments', financial_comments,
    'entry_date', entry_date,
    'nbo', nbo,
    'dd', dd,
    'passed', passed,
    'pass_reason', pass_reason,
    'created_at', created_at,
    'updated_at', updated_at,
    'archived', archived,
    'screening_pdf_url', screening_pdf_url,
    'screening_score', screening_score,
    'screening_thesis', screening_thesis,
    'screening_why_own', screening_why_own,
    'screening_why_now', screening_why_now,
    'screening_exit_story', screening_exit_story,
    'screening_missing_data', screening_missing_data,
    'screening_next_steps', screening_next_steps,
    'screening_raw_analysis', screening_raw_analysis,
    'screening_updated_at', screening_updated_at
  ) AS payload
  FROM public.deals
) s
UNION ALL
SELECT 'deal_activities_original', md5(string_agg(md5(payload::text), '' ORDER BY id::text))
FROM (
  SELECT id, jsonb_build_object(
    'id', id, 'deal_id', deal_id, 'content', content, 'created_at', created_at
  ) AS payload
  FROM public.deal_activities
) s
UNION ALL
SELECT 'partners_original', md5(string_agg(md5(payload::text), '' ORDER BY id::text))
FROM (
  SELECT id, jsonb_build_object(
    'id', id,
    'name', name,
    'role', role,
    'sector_focus', sector_focus,
    'region_focus', region_focus,
    'relevant_deals', relevant_deals,
    'notes', notes,
    'email', email,
    'phone', phone,
    'created_at', created_at,
    'updated_at', updated_at,
    'job_title', job_title,
    'company', company,
    'description', description,
    'linkedin', linkedin,
    'last_contacted', last_contacted,
    'avatar_url', avatar_url,
    'tags', tags
  ) AS payload
  FROM public.partners
) s
UNION ALL
SELECT 'realized_deals_original', md5(string_agg(md5(payload::text), '' ORDER BY id::text))
FROM (
  SELECT id, jsonb_build_object(
    'id', id,
    'company_name', company_name,
    'status', status,
    'team_member', team_member,
    'source', source,
    'sector', sector,
    'company_description', company_description,
    'description', description,
    'owners', owners,
    'deal_type', deal_type,
    'sales', sales,
    'ebitda', ebitda,
    'debt', debt,
    'comments', comments,
    'country', country,
    'entry_date', entry_date,
    'pass_reason', pass_reason,
    'created_at', created_at,
    'updated_at', updated_at
  ) AS payload
  FROM public.realized_deals
) s;

-- After the migration: every deal has one initial stage row, and original flags still explain it.
SELECT
  (SELECT count(*) FROM public.deals) AS deals,
  (SELECT count(*) FROM public.deal_stage_history WHERE note = 'Initial stage' AND field = 'stage') AS initial_stage_rows,
  (SELECT count(*) FROM public.deals WHERE deal_stage IS NULL) AS missing_stage,
  (SELECT count(*) FROM public.deals WHERE dd IS TRUE AND deal_stage IS DISTINCT FROM 'Due Diligence') AS dd_mismatch,
  (SELECT count(*) FROM public.deals WHERE dd IS NOT TRUE AND nbo IS TRUE AND deal_stage IS DISTINCT FROM 'NBIO / Term Sheet') AS nbo_mismatch,
  (SELECT count(*) FROM public.deals WHERE dd IS NOT TRUE AND nbo IS NOT TRUE AND (tier::text = 'passed' OR passed IS TRUE) AND deal_stage IS DISTINCT FROM 'Passed') AS passed_mismatch;

-- Sectors with no lookup row. Expect zero on the live distinct list.
SELECT sector, count(*)
FROM public.deals
WHERE sector IS NOT NULL
  AND btrim(sector) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.sector_group_map m WHERE m.source_sector = btrim(deals.sector)
  )
GROUP BY sector
ORDER BY sector;

-- Financial text that did not become a number.
-- Empty, '-' and percentages are intentional nulls (40% is a margin, not an amount).
SELECT id, company_name, field, raw
FROM (
  SELECT id, company_name, 'latest_sales' AS field, latest_sales AS raw, sales_amount AS amount
  FROM public.deals
  UNION ALL
  SELECT id, company_name, 'latest_ebitda', latest_ebitda, ebitda_amount FROM public.deals
  UNION ALL
  SELECT id, company_name, 'net_debt_cash', net_debt_cash, net_debt_amount FROM public.deals
) parsed
WHERE raw IS NOT NULL
  AND btrim(raw) <> ''
  AND btrim(raw) <> '-'
  AND position('%' IN raw) = 0
  AND amount IS NULL
ORDER BY field, raw;
