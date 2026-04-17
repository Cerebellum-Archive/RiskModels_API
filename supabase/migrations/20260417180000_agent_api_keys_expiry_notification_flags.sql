-- Track which API key expiry reminder emails were sent (dedupe per key per milestone).
ALTER TABLE agent_api_keys
  ADD COLUMN IF NOT EXISTS expiry_notified_14d_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expiry_notified_7d_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expiry_notified_1d_at TIMESTAMPTZ;

COMMENT ON COLUMN agent_api_keys.expiry_notified_14d_at IS 'When the ~14 days before expiry reminder was sent (cron)';
COMMENT ON COLUMN agent_api_keys.expiry_notified_7d_at IS 'When the ~7 days before expiry reminder was sent (cron)';
COMMENT ON COLUMN agent_api_keys.expiry_notified_1d_at IS 'When the ~1 day before expiry reminder was sent (cron)';
