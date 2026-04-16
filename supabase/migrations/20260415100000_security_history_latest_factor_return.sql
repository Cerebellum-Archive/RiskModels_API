-- Per-level incremental factor-return metrics (daily simple returns from
-- ds_erm3_returns_* zarr, `factor_return` data_var).
--
-- Semantic: at each level L ∈ {market, sector, subsector}, `l*_fr` is the
-- INCREMENTAL contribution of that level's factor alone, NOT cumulative
-- through the level. Relationship to `l*_cfr` (combined factor return,
-- already present):
--
--   l1_cfr = l1_fr                 (market only)
--   l2_cfr = l1_fr + l2_fr         (market + sector)
--   l3_cfr = l1_fr + l2_fr + l3_fr (market + sector + subsector)
--
-- And: gross_return = l3_cfr + l3_rr (at the subsector level).
--
-- Use cases: charting each level's contribution as a stacked bar (factor
-- decomposition), or letting a reasoning agent explain "what drove today's
-- return" by pointing at the largest-magnitude level.
--
-- Idempotent: safe if columns already exist.

ALTER TABLE public.security_history_latest ADD COLUMN IF NOT EXISTS l1_fr DOUBLE PRECISION;
ALTER TABLE public.security_history_latest ADD COLUMN IF NOT EXISTS l2_fr DOUBLE PRECISION;
ALTER TABLE public.security_history_latest ADD COLUMN IF NOT EXISTS l3_fr DOUBLE PRECISION;

COMMENT ON COLUMN public.security_history_latest.l1_fr IS
  'L1 (market) incremental factor return. Equal to l1_cfr. Daily simple return from ds_erm3_returns_*.zarr factor_return[level=market].';
COMMENT ON COLUMN public.security_history_latest.l2_fr IS
  'L2 (sector) incremental factor return. Sector-alone contribution. l2_cfr = l1_fr + l2_fr.';
COMMENT ON COLUMN public.security_history_latest.l3_fr IS
  'L3 (subsector) incremental factor return. Subsector-alone contribution. l3_cfr = l1_fr + l2_fr + l3_fr.';
