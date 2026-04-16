-- Add missing PRIMARY KEY constraints to security_history_latest, macro_factors,
-- and trading_calendar.
--
-- These tables were originally created with PK declarations in their CREATE TABLE
-- statements (see 20260317000000_create_security_history_latest.sql and
-- scripts/sql/macro_factors.sql), but the current live database has zero
-- constraints on them:
--
--     SELECT con.conname, con.contype FROM pg_constraint con
--     JOIN pg_class t ON con.conrelid = t.oid
--     WHERE t.relname IN (
--       'security_history_latest', 'macro_factors', 'trading_calendar'
--     );
--     -- 0 rows
--
-- Likely cause: the tables were first created via a path that did not include
-- the PK clause, and subsequent `CREATE TABLE IF NOT EXISTS` migrations were
-- no-ops because the tables already existed. Result: every `upsert(...,
-- on_conflict=...)` call from the sync layer fails with Postgres error 42P10
-- "no unique or exclusion constraint matching the ON CONFLICT specification",
-- silently leaving 0 rows written.
--
-- This was observed in run 099f2ff0 on 2026-04-15 — `build_latest_from_zarr`
-- generated 5211 correct wide rows but 0 landed in `security_history_latest`.
-- Similar 42P10 errors on `macro_factors` (96 rows) and `trading_calendar`.
--
-- Verified pre-flight (via `dedup check` psql queries):
--   security_history_latest : 2998 rows, 2998 distinct (symbol, periodicity) — clean
--   macro_factors           : 11193 rows, 11193 distinct (factor_key, teo)   — clean
--   trading_calendar        : 1260 rows, 1260 distinct (teo, periodicity)    — clean
-- No dedup step is needed before adding the PK constraints.
--
-- All three ALTERs are wrapped in DO blocks that check pg_constraint first, so
-- this migration is idempotent and safe to re-run.

-- security_history_latest: PRIMARY KEY (symbol, periodicity)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class t ON con.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'security_history_latest'
      AND con.contype = 'p'
  ) THEN
    ALTER TABLE public.security_history_latest
      ADD CONSTRAINT security_history_latest_pkey PRIMARY KEY (symbol, periodicity);
    RAISE NOTICE 'Added PRIMARY KEY (symbol, periodicity) on security_history_latest';
  ELSE
    RAISE NOTICE 'security_history_latest already has a PRIMARY KEY — skipping';
  END IF;
END $$;

-- macro_factors: PRIMARY KEY (factor_key, teo)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class t ON con.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'macro_factors'
      AND con.contype = 'p'
  ) THEN
    ALTER TABLE public.macro_factors
      ADD CONSTRAINT macro_factors_pkey PRIMARY KEY (factor_key, teo);
    RAISE NOTICE 'Added PRIMARY KEY (factor_key, teo) on macro_factors';
  ELSE
    RAISE NOTICE 'macro_factors already has a PRIMARY KEY — skipping';
  END IF;
END $$;

-- trading_calendar: PRIMARY KEY (teo, periodicity)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class t ON con.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'trading_calendar'
      AND con.contype = 'p'
  ) THEN
    ALTER TABLE public.trading_calendar
      ADD CONSTRAINT trading_calendar_pkey PRIMARY KEY (teo, periodicity);
    RAISE NOTICE 'Added PRIMARY KEY (teo, periodicity) on trading_calendar';
  ELSE
    RAISE NOTICE 'trading_calendar already has a PRIMARY KEY — skipping';
  END IF;
END $$;
