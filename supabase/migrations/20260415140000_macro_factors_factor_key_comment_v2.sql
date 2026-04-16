-- Update macro_factors.factor_key column comment to reflect the v2 ten-factor set.
-- Superseded: 20260329203000_macro_factors_factor_key_comment.sql which listed only
-- 6 factors (bitcoin, gold, oil, dxy, vix, ust10y2y). The v2 set restores gold
-- (dropped at some point) and adds inflation/short_rates/credit/volatility.
--
-- Canonical (v2): inflation, term_spread, short_rates, credit, oil, gold, usd,
-- volatility, bitcoin, vix_spot.
--
-- Legacy v1 names (dxy, vix, ust10y2y) may still appear in historical rows; the API's
-- lib/risk/macro-factor-keys.ts layer accepts both when resolving queries.

COMMENT ON COLUMN public.macro_factors.factor_key IS
  'Lowercase canonical keys: inflation (TIP), term_spread (VGIT), short_rates (BIL), credit (HYG), oil (USO), gold (GLD), usd (UUP), volatility (VXX short-term vol futures), bitcoin (BITO), vix_spot (FRED VIXCLS spot index). volatility and vix_spot are distinct — VXX has futures roll dynamics, VIXCLS is pure spot. Legacy v1 names dxy→usd, vix→vix_spot, ust10y2y→term_spread still appear in historical rows and the API normalizes them on read.';
