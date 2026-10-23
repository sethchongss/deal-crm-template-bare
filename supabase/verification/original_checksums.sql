-- Run this BEFORE and AFTER the Stage 2 migrations.
-- It only reads columns and tables that existed on 3 Oct 2026.
-- The digests must match. A changed original value changes the digest.
-- jsonb_build_object keeps nulls, so a null becoming a value is visible.

SELECT 'deals' AS table_name, count(*) AS rows FROM public.deals
UNION ALL SELECT 'deal_activities', count(*) FROM public.deal_activities
UNION ALL SELECT 'partners', count(*) FROM public.partners
UNION ALL SELECT 'realized_deals', count(*) FROM public.realized_deals
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
