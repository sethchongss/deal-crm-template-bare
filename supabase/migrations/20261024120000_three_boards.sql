-- Three boards: Active, Pipeline, Passed / Out.
-- Folds the two old active boards (active_tier_1, active_tier_2) into 'active'.
-- Pipeline and Passed / Out are unchanged. Default board stays 'pipeline'.
-- Safe to re-run: does nothing once public.deal_tier already has the three values.
-- Requires 20261003110000_base_schema.sql.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'deal_tier'
      AND e.enumlabel IN ('active_tier_1', 'active_tier_2')
  ) THEN
    CREATE TYPE public.deal_tier_v3 AS ENUM ('active', 'pipeline', 'passed');

    ALTER TABLE public.deals ALTER COLUMN tier DROP DEFAULT;
    -- ALTER COLUMN ... TYPE rewrites rows without firing row triggers,
    -- so updated_at and stage history are left as they were.
    ALTER TABLE public.deals
      ALTER COLUMN tier TYPE public.deal_tier_v3
      USING (
        CASE tier::text
          WHEN 'active_tier_1' THEN 'active'
          WHEN 'active_tier_2' THEN 'active'
          ELSE tier::text
        END
      )::public.deal_tier_v3;

    DROP TYPE public.deal_tier;
    ALTER TYPE public.deal_tier_v3 RENAME TO deal_tier;
    ALTER TABLE public.deals ALTER COLUMN tier SET DEFAULT 'pipeline'::public.deal_tier;
  END IF;
END $$;

ALTER TABLE public.deals ALTER COLUMN tier SET DEFAULT 'pipeline'::public.deal_tier;

-- Old history rows keep their original text. Readers map the retired
-- active_tier_1 / active_tier_2 values to 'active'.
