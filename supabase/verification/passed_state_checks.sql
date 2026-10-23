-- Run AFTER 20261003150000_passed_state.sql.
-- Original-column checksums stay in original_checksums.sql. This file does not write.

-- Every deal on the Passed / Out board, or with the original passed flag, is marked passed.
SELECT count(*) AS passed_board_missing_flag
FROM public.deals
WHERE (tier = 'passed'::public.deal_tier OR passed = true)
  AND is_passed = false;

-- The stage value 'Passed' is no longer used. Passed lives in is_passed.
SELECT count(*) AS stage_still_passed
FROM public.deals
WHERE deal_stage = 'Passed';

-- Rows whose stage was rewritten can be restored from this snapshot.
SELECT count(*) AS stage_restore_rows
FROM private.passed_stage_restore;

-- A passed deal keeps a real stage. This lists any that do not.
SELECT id, company_name, tier, deal_stage, is_passed
FROM public.deals
WHERE is_passed = true
  AND deal_stage IS NULL;
