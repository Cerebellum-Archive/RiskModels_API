-- Migration: Add Daily Spend Cap Fields
-- Date: 2026-04-16
-- Description: Daily spend ceiling for abuse protection (runaway agent loops via MCP/CLI).
--              Complements the existing monthly cap. Defaults to NULL (unlimited) for
--              existing users; scoped MCP keys will seed a $5/day default at mint time.

ALTER TABLE agent_accounts
ADD COLUMN IF NOT EXISTS daily_spend_cap DECIMAL(12,4) DEFAULT NULL,  -- NULL = no cap
ADD COLUMN IF NOT EXISTS daily_spend_usd DECIMAL(12,4) DEFAULT 0.00,  -- today's spend
ADD COLUMN IF NOT EXISTS daily_spend_reset_at TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN agent_accounts.daily_spend_cap IS 'Hard limit on per-UTC-day API spend (NULL = unlimited). Primary defense against runaway agent loops.';
COMMENT ON COLUMN agent_accounts.daily_spend_usd IS 'Accumulated spend for the current UTC day.';
COMMENT ON COLUMN agent_accounts.daily_spend_reset_at IS 'Timestamp of the last daily_spend_usd reset.';

CREATE INDEX IF NOT EXISTS idx_agent_accounts_daily_reset
ON agent_accounts(daily_spend_reset_at)
WHERE daily_spend_cap IS NOT NULL;

-- Reset daily counter if the last reset was before 00:00 UTC today.
CREATE OR REPLACE FUNCTION check_reset_daily_spend(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_last_reset TIMESTAMPTZ;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT daily_spend_reset_at INTO v_last_reset
  FROM agent_accounts
  WHERE user_id = p_user_id;

  IF v_last_reset IS NULL THEN
    UPDATE agent_accounts
    SET daily_spend_reset_at = v_now
    WHERE user_id = p_user_id;
    RETURN;
  END IF;

  -- Reset when we cross a UTC day boundary.
  IF DATE_TRUNC('day', v_last_reset AT TIME ZONE 'UTC') < DATE_TRUNC('day', v_now AT TIME ZONE 'UTC') THEN
    UPDATE agent_accounts
    SET daily_spend_usd = 0.00,
        daily_spend_reset_at = v_now
    WHERE user_id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_reset_daily_spend IS 'Resets daily spend counter if we have crossed a UTC day boundary.';

CREATE OR REPLACE FUNCTION add_to_daily_spend(p_user_id UUID, p_amount DECIMAL(12,4))
RETURNS VOID AS $$
BEGIN
  PERFORM check_reset_daily_spend(p_user_id);
  UPDATE agent_accounts
  SET daily_spend_usd = daily_spend_usd + p_amount
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION add_to_daily_spend IS 'Adds amount to daily spend total (with auto-reset check).';
