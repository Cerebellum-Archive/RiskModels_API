# RiskModels API QA Report - v3.0.0-agent

**Date:** March 11, 2026
**Tester:** Jules (Senior QA Engineer)
**Environment:** Production (https://riskmodels.net/api)

## Executive Summary
The API shows strong functional performance for core metered endpoints (`/batch/analyze`, `/metrics`). However, significant issues were identified in the new OAuth2 flow and metadata consistency.

---

## Bug Report

| Severity | ID | Description |
|----------|----|-------------|
| **Critical** | BUG-001 | **OAuth2 Token Generation Failure**: `POST /auth/token` returns 401 Unauthorized for valid client credentials. This prevents AI agents from using the standard OAuth2 flow. |
| **High** | BUG-002 | **Risk Math Logic Error**: `GET /metrics/{ticker}` returns zero values for ER (Explained Risk) fields (`l3_mkt_er`, etc.), causing the sum-to-one validation to fail. |
| **High** | BUG-003 | **Authentication Inconsistency**: `/ticker-returns` does not accept standard Bearer tokens that work on other metered endpoints, returning 401. |
| **Low** | BUG-004 | **Missing Lineage Headers**: Response headers `X-Risk-Model-Version` are missing from `/metrics` responses despite being specified in the OpenAPI documentation. |

---

## Schema Compliance Table

| Endpoint | Status | Deviation Notes |
|----------|--------|-----------------|
| `POST /auth/token` | ❌ FAIL | Always returns 401 with current credentials. |
| `GET /metrics/{ticker}` | ⚠️ PARTIAL | Missing headers `X-Risk-Model-Version`. ER fields are all 0. |
| `GET /ticker-returns` | ❌ FAIL | Returns 401 for tokens that are valid for other routes. |
| `POST /batch/analyze` | ✅ PASS | Schema matches spec. Cost discount verified ($0.002/pos). |
| `GET /health` | ✅ PASS | Returns 200 and correct status object. |

---

## Performance Notes

- **Average Latency:** 350ms
- **Peak Latency:** 1141ms (`/batch/analyze` with 10 tickers)
- **High Latency Alert:** No endpoint exceeded the 500ms threshold for single calls, but `/batch/analyze` reached 1.1s for 10 tickers, which is expected given the processing requirements.
- **Rate Limiting:** Verified `X-RateLimit-Remaining` decrements correctly on `/metrics`.

---

## Test Artifacts
- **Test Suite:** `tests/qa/api_test_suite.ts`
- **Execution Log:** `tests/qa/output.txt`
