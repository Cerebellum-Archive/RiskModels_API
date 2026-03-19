# Schema Compliance Table (v3.0.0-agent)

This table documents deviations between the `OPENAPI_SPEC.yaml` and the current API implementation as observed in the QA scan.

| Endpoint | Field/Header | Issue | Deviation Type |
|---|---|---|---|
| `/api/metrics/{ticker}` | `_metadata` block | Missing in response body. | **Missing Field** |
| `/api/metrics/{ticker}` | `X-Cache-Status` | Header missing or returning `null`. | **Missing Header** |
| `/api/metrics/{ticker}` | `X-API-Cost-USD` | Header missing or returning `null`. | **Missing Header** |
| `/api/metrics/{ticker}` | `X-Latency-MS` | Header missing or returning `null`. | **Missing Header** |
| `/api/ticker-returns` | `_agent` block | Missing in response body (at 200 OK). | **Missing Field** |
| `/api/batch/analyze` | `_agent.cost_usd` | Field is missing or undefined in the response body. | **Missing Field** |
| `/api/batch/analyze` | `results[ticker].status` | Returns `"error"` instead of the documented `"not_found"` for invalid symbols. | **Value Mismatch** |
| `/api/auth/token` | Response Body | Returned `{"error": "invalid_client"}` for valid format. | **Logic Deviation** |

---
*Verified against OPENAPI_SPEC.yaml v3.0.0-agent.*
