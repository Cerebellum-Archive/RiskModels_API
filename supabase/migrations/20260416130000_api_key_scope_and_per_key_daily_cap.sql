-- Migration: Per-Key Scope and Per-Key Daily Spend Cap
-- Date: 2026-04-16
-- Description: Adds a tight-blast-radius key variant for MCP / agent clients.
--              `key_scope` tags keys ('mcp', 'cli', 'server', etc.) for audit
--              and for downstream policy (e.g. endpoint allowlist).
--              `daily_spend_cap_usd` lets us mint a stricter per-key cap than
--              the account-level daily_spend_cap — primary defense against a
--              leaked or runaway MCP key.

ALTER TABLE agent_api_keys
ADD COLUMN IF NOT EXISTS key_scope TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS daily_spend_cap_usd DECIMAL(12,4) DEFAULT NULL;

COMMENT ON COLUMN agent_api_keys.key_scope IS 'Optional tag describing the intended caller profile (e.g. mcp, cli, server). Used for policy + audit; not a hard permission.';
COMMENT ON COLUMN agent_api_keys.daily_spend_cap_usd IS 'Per-key daily USD spend cap (NULL = fall back to account-level daily_spend_cap). Scoped MCP keys seed this to $5.00.';

CREATE INDEX IF NOT EXISTS idx_agent_api_keys_scope
ON agent_api_keys(key_scope)
WHERE key_scope IS NOT NULL;

-- Convention for future mint flow (documented, not enforced by DB):
--   key_prefix pattern                daily_spend_cap_usd   rate_limit_per_minute
--   rm_agent_*           (existing)   NULL (account-level)  60
--   rm_agent_mcp_*       (new MCP)    5.00                  30
--   rm_agent_readonly_*  (future)     NULL                  60
