-- Restores the four-board enum. Every 'active' deal goes back to active_tier_1;
-- the split between the two old active boards is not recoverable.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'deal_tier' AND e.enumlabel = 'active'
  ) THEN
    CREATE TYPE public.deal_tier_v2 AS ENUM ('active_tier_1', 'active_tier_2', 'pipeline', 'passed');
    ALTER TABLE public.deals ALTER COLUMN tier DROP DEFAULT;
    ALTER TABLE public.deals
      ALTER COLUMN tier TYPE public.deal_tier_v2
      USING (CASE tier::text WHEN 'active' THEN 'active_tier_1' ELSE tier::text END)::public.deal_tier_v2;
    DROP TYPE public.deal_tier;
    ALTER TYPE public.deal_tier_v2 RENAME TO deal_tier;
    ALTER TABLE public.deals ALTER COLUMN tier SET DEFAULT 'pipeline'::public.deal_tier;
  END IF;
END $$;
