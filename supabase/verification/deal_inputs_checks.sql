-- Run AFTER 20261003150100 and 20261003150200.
-- Confirms the new columns and the wider checks. Does not write.

SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'deals'
  AND column_name IN (
    'is_passed', 'passed_at', 'passed_reason',
    'legal_name', 'financial_year', 'enterprise_value',
    'transaction_type', 'stake_percent', 'ticket_size', 'vendor'
  )
ORDER BY column_name;

SELECT conname
FROM pg_constraint
WHERE conname IN ('deal_tasks_status_check', 'partners_role_check', 'deal_partners_role_check', 'deals_stake_percent_check')
ORDER BY conname;
