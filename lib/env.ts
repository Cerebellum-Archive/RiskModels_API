// Minimal env shim for migrated agent files (Phase 2).
// RiskModels_API reads process.env directly; this object provides the same
// shape that rate-limiter.ts (and any future agent files) expect from @/lib/env.
export const env = {
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
};
