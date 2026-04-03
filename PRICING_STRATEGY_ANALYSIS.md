# RiskModels API — Pricing Strategy Analysis

*April 2026 | Prepared for internal use*

---

## 1. Overall Assessment

RiskModels has built a pricing system that is unusually well-suited for agentic consumption — flat per-request costs, a free `/estimate` endpoint, `_agent.cost_usd` in response bodies, and billing headers on every call. This is a genuine competitive advantage in a market where most financial data APIs (Bloomberg BVAL, Refinitiv, even newer players like Polygon.io) still rely on opaque subscription tiers or seat-based licensing that makes programmatic cost control nearly impossible. The $20 starter credits with no expiry and the "Enterprise Analytics, Not Enterprise Pricing" positioning are strong differentiators against incumbents.

That said, there are three structural weaknesses to address. First, the **pricing page speaks in "tokens" while the billing engine charges per-request** — the PricingEstimator converts requests to tokens at made-up conversion rates (250-500 tokens/request), but `calculateRequestCost()` never uses token counts for `per_request` endpoints. This creates a trust gap when a developer reads the pricing page, estimates cost in tokens, then sees flat `$0.005` charges in their billing events. Second, there is **no formalized volume discount path** between the $100 credit pack and the "email us" enterprise tier — the $5K-$50K/year mid-market segment is underserved. Third, the **per-request flat fee doesn't capture value** on high-compute endpoints like portfolio risk index or batch analysis of 200+ positions, where the same $0.005 call might return 50KB vs 500KB of data.

Compared to best-in-class financial data API pricing (Polygon.io's tiered subscription + usage, Alpha Vantage's credit system, Tiingo's flat monthly + API limits), RiskModels' pay-as-you-go model is simpler and more agent-friendly. But it leaves revenue on the table from power users and creates mild confusion through the token abstraction layer.

---

## 2. Key Recommendations (Prioritized)

### 2.1 Fix the Token/Per-Request Mismatch (Priority: Critical, Effort: Low)

**Why it matters:** The pricing page says "$20 per 1M tokens" and the estimator converts requests to tokens (250-500 tokens per request), but `calculateRequestCost()` charges flat `per_request` fees for 18 of 23 capabilities. An agent developer who reads the docs, runs the estimator, and then inspects their `billing_events` table will see `cost_usd: 0.005` with no token count — and wonder what happened to the token math. This is the single biggest credibility risk in the current pricing. Polygon.io and Tiingo both suffered user backlash when their pricing pages didn't match actual billing behavior.

**How to implement:**

Choose one of two paths:

*Path A — Embrace per-request (recommended):* Rewrite the pricing page to lead with per-request costs. Replace the "500 tokens" column in the usage table with the actual `cost_usd` from capabilities.ts. Remove the `USD_PER_MILLION_TOKENS` constant from PricingEstimator and replace it with a dropdown of actual endpoints times a request count. Keep the "~$20 per 1M tokens" as a footnote-level "effective rate" comparison for people coming from LLM pricing, but don't make it the hero number.

Specific file changes:

- `app/pricing/page.tsx` lines 19-37: Replace `usageRows` tokens column with actual `cost_usd` values from capabilities.
- `components/pricing/PricingEstimator.tsx`: Replace token-based calculation with endpoint-picker + request-count model. Show `monthlyRequests * selectedEndpoint.cost_usd` directly.
- `OPENAPI_SPEC.yaml`: Ensure each endpoint's description includes the exact `cost_usd`, not a token approximation.

*Path B — Actually implement token billing:* Convert all `per_request` endpoints to `per_token` with metered response-size-based token counts. This is a much larger refactor and would break the "flat fee per call regardless of data size" value proposition that agents love.

**Expected impact:** Eliminates the #1 source of developer confusion. Builds trust with the agent builder community where cost predictability is table-stakes. No revenue impact (prices stay the same, just described honestly).

**Potential downsides:** Path A means abandoning the "tokens" framing that feels familiar to LLM-era developers. Mitigation: keep a "token-equivalent" comparison row, just don't make it the primary unit.

---

### 2.2 Introduce Committed-Use Volume Tiers (Priority: High, Effort: Medium)

**Why it matters:** The current model jumps from "$100 credit pack" to "email us for 10M+ tokens/month." A quant shop doing 50K requests/month (~$250/month on mixed endpoints) has no incentive to commit, no discount for loyalty, and no path between self-serve and enterprise. Polygon.io captures this segment with their "Stocks Starter" ($29/mo, 5 calls/min) through "Business" ($199/mo, unlimited) tiers. Alpha Vantage uses a $49.99/mo "Premium" tier with 75 req/min.

**How to implement:**

Add 2-3 committed-spend tiers to the billing system:

| Tier | Monthly Commit | Discount | Rate Limit | Auto-Provision |
|------|---------------|----------|------------|----------------|
| Growth | $100/mo | 10% bonus credits ($110 effective) | 60 req/min | Self-serve |
| Pro | $500/mo | 15% bonus credits ($575 effective) | 120 req/min | Self-serve |
| Enterprise | $2,000+/mo | 20%+ negotiated | 300+ req/min | Sales-assisted |

Implementation: Add a `tier` field to `agent_accounts` (free, growth, pro, enterprise). In `billing-middleware.ts`, apply the bonus credit multiplier when processing `balance_top_ups` for committed-tier users. The monthly commit becomes a Stripe subscription that auto-credits the account on the 1st. Overage beyond the committed amount bills at standard rates.

Changes needed:
- `supabase/migrations/`: New migration adding `tier` enum to `agent_accounts`, `committed_monthly_usd` column.
- `lib/agent/billing.ts`: Modify `addBalance()` to apply tier multiplier.
- `lib/agent/billing-middleware.ts`: Read tier from account, apply rate limit override.
- `app/pricing/page.tsx`: Add tier comparison cards between the main pricing card and the enterprise section.

**Expected impact:** Captures the $1K-$20K ARR mid-market segment. Based on SaaS benchmarks, committed tiers typically convert 15-25% of active pay-as-you-go users within 6 months, with 2-3x higher retention. For a product with 200 active paying users, this could mean 30-50 committed accounts at $100-$500/mo = $36K-$300K incremental ARR.

**Potential downsides:** Adds billing complexity. Mitigation: keep pay-as-you-go as the default; tiers are opt-in via a dashboard toggle. Don't sunset the simple model.

---

### 2.3 Add Per-Request Cost to Every Response Body (Priority: High, Effort: Low)

**Why it matters:** The billing headers (`X-API-Cost-USD`, `X-Balance-Remaining`) are excellent, but agents parsing JSON often ignore headers. The `_agent.cost_usd` field exists in some responses but isn't guaranteed across all endpoints. Making cost a first-class field in every JSON response body is a strong agent-delight signal — it's the equivalent of how Stripe includes `balance_transactions` in every charge object.

**How to implement:**

In `billing-middleware.ts`, after the billing deduction succeeds, inject a standard `_billing` object into the response JSON:

```json
{
  "_billing": {
    "cost_usd": 0.005,
    "balance_remaining_usd": 14.35,
    "capability": "ticker-returns",
    "pricing_model": "per_request",
    "request_id": "req_abc123"
  }
}
```

This is a ~20-line change in the middleware's response interceptor. Ensure it's documented in the OpenAPI spec as a common response field.

**Expected impact:** Significant quality-of-life improvement for agent builders. Reduces support tickets about "how much did that cost?" Enables agents to build cost-aware decision trees without parsing headers.

**Potential downsides:** Slightly increases response payload size (~100 bytes). Mitigation: negligible for JSON endpoints; could be opt-out via `?include_billing=false` query parameter.

---

### 2.4 Implement Value-Based Pricing for Portfolio Endpoints (Priority: Medium, Effort: Medium)

**Why it matters:** `portfolio-risk-index` charges a flat $0.005 whether the portfolio has 5 positions or 500. A 500-position portfolio risk decomposition is dramatically more compute-intensive and more valuable to the user than a 5-position one. This is leaving significant revenue on the table and creates a subsidy where light users effectively pay for heavy users' compute. Bloomberg's PORT analytics and MSCI Barra both price portfolio analytics by position count or AUM tier.

**How to implement:**

Convert `portfolio-risk-index` from `per_request` to `per_position` pricing (matching `batch-analysis` and `portfolio-returns` which already use this model):

```typescript
// capabilities.ts — portfolio-risk-index
pricing: {
  model: "per_position",
  cost_usd: 0.001,        // per position
  min_charge: 0.005,      // minimum (same as current flat rate for 5 positions)
  currency: "USD",
  billing_code: "portfolio_risk_index_v2",
}
```

This preserves backward compatibility for small portfolios (5 positions still costs $0.005) while properly metering large portfolios (100 positions = $0.10, 500 positions = $0.50).

Similarly, consider whether `factor-correlation` should scale with `window_days` — a 2000-day correlation window is 8x the compute of the default 252-day window but costs the same $0.002.

**Expected impact:** Revenue increase of 20-40% on portfolio endpoints from power users, with no impact on small/casual users. Aligns cost with value delivered.

**Potential downsides:** Breaks the "one flat fee per call" simplicity that agents rely on. Mitigation: the `/estimate` endpoint already supports `itemCount` — agents already know how to handle per-position pricing. Document the change clearly and grandfather existing users for 30 days.

---

### 2.5 Build a Self-Serve Enterprise Dashboard (Priority: Medium, Effort: High)

**Why it matters:** "Email us" is a conversion killer. Stripe's growth was built on self-serve pricing pages where you could see exactly what you'd pay at any scale. The current enterprise section asks users to email `service@riskmodels.app` — this adds friction, delays, and loses the developer-first ethos. Every competitor from Polygon to Quandl has moved toward self-serve enterprise sign-up.

**How to implement:**

Replace the "email us" enterprise section with a self-serve committed-spend calculator:

1. Let users enter their expected monthly request volume.
2. Show them the committed tier that fits (per recommendation 2.2).
3. Allow one-click upgrade to that tier via Stripe Checkout.
4. For truly custom needs (>$2K/mo), show a Calendly/HubSpot booking link instead of a bare email address.

Add a `/api/user/upgrade-tier` endpoint that handles the Stripe subscription creation and account upgrade atomically.

**Expected impact:** Reduces enterprise conversion friction from days to minutes. Based on B2B SaaS benchmarks, self-serve enterprise paths convert 3-5x better than "contact sales" for deals under $25K ARR.

**Potential downsides:** Loses the personal touch of email conversations for large deals. Mitigation: keep email/Calendly for $2K+/mo; self-serve handles everything below that.

---

### 2.6 Add a "Cost Budget" Feature for Agent Sessions (Priority: Medium, Effort: Low)

**Why it matters:** AI agents running autonomously can make hundreds of API calls in a session. The monthly spend cap helps at the account level, but agents need per-session or per-task budget controls. This is an emerging best practice — OpenAI's function calling docs recommend cost guardrails, and Anthropic's tool use patterns include budget-aware loops. RiskModels can lead here.

**How to implement:**

Add an optional `X-Budget-USD` request header. The billing middleware checks cumulative session spend (keyed by a `X-Session-ID` header or a `session_id` query parameter) against this budget. If the next request would exceed the budget, return `HTTP 402` with a `budget_exceeded` error code and the cumulative session spend.

Changes:
- `billing-middleware.ts`: Add session spend tracking (Redis counter, TTL 1 hour).
- Response headers: Add `X-Session-Spend-USD` and `X-Session-Budget-Remaining-USD`.
- `/estimate` endpoint: Accept `session_id` and return cumulative session spend in the estimate response.

**Expected impact:** Strong agent-adoption signal. Makes RiskModels the go-to API for agentic financial workflows where cost control is a first-class concern. Minimal engineering effort (Redis counter + header parsing).

**Potential downsides:** Adds a Redis dependency for session tracking. Mitigation: already using Upstash Redis for rate limiting — this is the same pattern.

---

### 2.7 Publish a Machine-Readable Pricing Manifest (Priority: Low, Effort: Low)

**Why it matters:** Agents increasingly discover and evaluate APIs programmatically. A machine-readable pricing manifest (JSON or YAML) at a well-known URL (e.g., `/api/pricing.json`) allows agent frameworks to automatically compare costs, select the cheapest endpoint for a task, and plan multi-step workflows with cost budgets. This is the "robots.txt of API pricing."

**How to implement:**

Add a `/api/pricing` endpoint that serializes the `CAPABILITIES` array's pricing fields:

```json
{
  "version": "2026-04-01",
  "currency": "USD",
  "endpoints": [
    {
      "id": "ticker-returns",
      "path": "/api/ticker-returns",
      "pricing_model": "per_request",
      "cost_usd": 0.005,
      "free_tier_included": true
    },
    ...
  ],
  "tiers": { ... },
  "estimate_endpoint": "/api/estimate"
}
```

This is a ~30-line API route that reads from the existing `CAPABILITIES` constant.

**Expected impact:** Positions RiskModels as the most agent-transparent financial data API. Low effort, high signal value for the agentic developer community.

**Potential downsides:** Competitors can scrape your pricing. Mitigation: your prices are already public on the pricing page; this just makes them programmatically accessible.

---

### 2.8 Introduce Cached-Response Credits (Priority: Low, Effort: Medium)

**Why it matters:** The OpenAPI spec notes "cached responses are free," but there's no visible incentive for agents to use caching. If an agent requests AAPL metrics 10 times in a minute (common in multi-step workflows), they pay $0.01 instead of the $0.001 they'd pay with cache awareness. Making cache hits visibly free (with a `X-Cache-Hit: true` header and `cost_usd: 0.000` in the billing response) turns caching from an invisible optimization into a visible agent benefit.

**How to implement:**

In `billing-middleware.ts`, check for cache headers before billing. If the response is served from cache (Vercel ISR, Redis, etc.), skip the billing deduction entirely and return `X-API-Cost-USD: 0.000` with `X-Cache-Hit: true`.

**Expected impact:** Encourages agents to design cache-friendly request patterns. Reduces database load. Builds goodwill with cost-conscious developers.

**Potential downsides:** Revenue reduction on repeated queries. Mitigation: cached data is stale data (daily update frequency) — the marginal cost of serving it is near zero, and the goodwill value exceeds the lost $0.001-$0.005.

---

## 3. Pricing Model Options to Consider

### Option A: Keep Flat Per-Request + Add Committed Tiers (Recommended)

**How it works:** Maintain the current per-request pricing as the default. Layer on committed-spend tiers (Growth $100/mo, Pro $500/mo) that provide bonus credits and higher rate limits. Enterprise remains negotiated.

**Pros:**
- Preserves the simplicity agents love.
- Committed tiers capture mid-market revenue without complicating the base model.
- Lowest migration risk — existing users see no change unless they opt in.
- The `/estimate` endpoint continues to return exact costs.

**Cons:**
- Doesn't fully capture value from high-compute endpoints (partially addressed by moving portfolio endpoints to per-position).
- Committed tiers add some billing logic complexity.

**Best fit for RiskModels:** Yes. This is the natural evolution of the current model. It preserves the "Enterprise Analytics, Not Enterprise Pricing" brand while creating a revenue escalation path.

---

### Option B: Credit-Based System (Like Alpha Vantage / OpenAI)

**How it works:** Replace per-request pricing with a universal credit system. Each API call consumes credits based on endpoint complexity (e.g., ticker-returns = 5 credits, L3 decomposition = 50 credits, batch analysis = 2 credits/position). Users buy credit packs or subscribe to monthly credit allowances.

**Pros:**
- Unified unit of account across all endpoints (avoids the current mix of per_request, per_token, per_position).
- Familiar to developers coming from OpenAI, Anthropic, or Alpha Vantage.
- Enables fine-grained value differentiation (expensive endpoints consume more credits without the cognitive overhead of different pricing models).
- Credit balances feel like a "game balance" — psychologically encourages spending.

**Cons:**
- Introduces an abstraction layer between cost and dollars — agents need to convert credits to USD, which is the same problem as the current token abstraction.
- Requires rewriting the billing engine to track credits instead of USD.
- Credit-based systems are often perceived as less transparent (the "Microsoft Points" problem).
- Breaks the current `_agent.cost_usd` transparency that's a key differentiator.

**Best fit for RiskModels:** No. The current USD-denominated per-request model is more transparent and agent-friendly than credits. Credits solve a problem RiskModels doesn't have (too many different pricing dimensions). The mix of per_request + per_position + per_token is only 3 models and is already well-handled by `calculateRequestCost()`.

---

### Option C: Hybrid Subscription + Usage (Like Polygon.io / Stripe)

**How it works:** Offer monthly subscription tiers that include a base allowance of requests, with per-request overage charges. Example: $49/mo includes 10K requests + $0.003/request overage. Higher tiers include more requests and lower overage rates.

**Pros:**
- Predictable base revenue (MRR) for the business.
- Users get cost predictability for their typical usage.
- Overage pricing captures upside from burst usage.
- Familiar model from Polygon.io, Twilio, AWS.

**Cons:**
- Subscriptions create "use it or lose it" psychology that can frustrate light-month users.
- Adds complexity to billing (subscription + metered overage).
- Conflicts with the "no subscriptions, no seat fees" brand positioning.
- Agents prefer pure usage-based pricing because their usage is inherently bursty and unpredictable.

**Best fit for RiskModels:** Not as the primary model. However, the committed-spend tiers from Option A are effectively a soft subscription (monthly auto-credit with bonus) without the "use it or lose it" downside — credits roll over. This captures the MRR benefit of subscriptions while preserving the pay-as-you-go flexibility.

---

## 4. Specific Endpoint Tweaks

### ticker-returns ($0.005/request)

**Current issue:** A 1-year request and a 15-year request cost the same $0.005, but the 15-year request returns ~15x more data and hits the database harder.

**Recommendation:** Keep the flat $0.005 for now. The "flat fee regardless of data size" is a powerful agent-trust signal and a genuine differentiator. However, monitor the distribution of `years` parameter values. If >20% of requests use `years >= 10`, consider a modest tiered approach: $0.005 for 1-5 years, $0.008 for 6-10, $0.012 for 11-15. Only implement this if database costs become material.

### batch-analysis ($0.002/position, min $0.01)

**Current state:** Well-priced with per-position scaling and a minimum charge. No changes needed to the pricing model.

**Recommendation:** Add a batch discount for large batches to encourage portfolio-level usage: 1-50 positions at $0.002, 51-200 at $0.0015, 201+ at $0.001. Implement in `calculateRequestCost()` with a simple tiered multiplier. This is how Twilio and SendGrid handle high-volume batch operations.

### chat-risk-analyst ($0.001/1K input, $0.002/1K output)

**Current state:** Per-token pricing is appropriate for a chat endpoint. The rates are reasonable compared to direct OpenAI pricing ($0.15/1M input, $0.60/1M output for GPT-4o-mini) — RiskModels adds ~6x markup over raw LLM costs, which is standard for value-added AI APIs.

**Recommendation:** Consider adding a `max_tokens` parameter (like OpenAI's) to give agents explicit cost control per chat call. Also consider a "chat session" concept where the first message in a session includes the system prompt cost, but follow-up messages in the same session don't re-incur it.

### portfolio-risk-index ($0.005 flat)

**Recommendation:** Convert to per-position as detailed in recommendation 2.4. This is the single highest-impact endpoint pricing change.

### macro-factors ($0.001/request)

**Current state:** Extremely cheap for what's delivered (years of daily factor returns for 6 macro factors). This is a loss-leader that drives adoption.

**Recommendation:** Keep at $0.001 — it's the "gateway drug" endpoint that hooks quant researchers. Consider making it completely free for the first 100 calls/month as part of the free tier to increase top-of-funnel conversion.

### factor-correlation ($0.002/request)

**Recommendation:** Consider scaling with `window_days`. A 2000-day correlation window is significantly more compute than 252 days. Possible formula: `base_cost * ceil(window_days / 252)`, so 252 days = $0.002, 504 days = $0.004, 2000 days = $0.016. This aligns cost with compute while keeping the default affordable.

### cli-query ($0.003/request)

**Recommendation:** This is an open SQL query endpoint — the compute variance is enormous depending on the query. Consider implementing query complexity scoring (based on estimated rows scanned) and charging accordingly. Short-term: add a `max_rows` cap at the current price point and charge $0.001 per additional 1000 rows.

---

## 5. Marketing & Transparency Improvements

### 5.1 Rewrite the Hero Pricing Card

**Current:** "$20 / 1M tokens" with "= $0.000020 per token"

**Problem:** Most endpoints don't bill by token. This is a fiction maintained for marketing simplicity.

**Suggested replacement:**

```
Pay-as-You-Go

From $0.001 per request
────────────────────────
Most endpoints: $0.001 – $0.01 per API call
Batch/portfolio: $0.002 per position (min $0.01)
AI chat: $0.001 / 1K input tokens, $0.002 / 1K output

= $0.000020 per token equivalent
```

This leads with the actual pricing model and relegates the token equivalent to a secondary comparison.

### 5.2 Replace the Token Usage Table

**Current table:**

| Request type | Tokens | Yield per $20 |
|---|---|---|
| Risk decomposition (full) | 500 | ~2,000 per $20 |
| Ticker returns lookup | 250 | ~4,000 per $20 |
| Batch position analysis | 100 / position | ~10,000 per $20 |

**Suggested replacement:**

| Endpoint | Cost per call | Calls per $20 |
|---|---|---|
| Risk metrics / rankings | $0.001 | 20,000 |
| Factor correlation | $0.002 | 10,000 |
| Ticker returns (any history length) | $0.005 | 4,000 |
| L3 risk decomposition | $0.01 | 2,000 |
| Batch analysis | $0.002 / position (min $0.01) | varies |
| AI chat | ~$0.003 per turn | ~6,600 |

This is honest, verifiable against the API responses, and more useful for planning.

### 5.3 Rewrite the PricingEstimator

Replace the token-based estimator with an endpoint-aware calculator:

- Dropdown: select primary endpoint (from capabilities list)
- Slider: monthly request count
- Output: `requests * endpoint.cost_usd = monthly cost`
- Secondary output: "With Growth tier commitment ($100/mo): $X (save Y%)"

### 5.4 Update the FAQ

**Current FAQ Q:** "Is there a volume discount?"
**Current answer:** References "10M+ tokens/month" — should reference request volume or dollar spend instead.

**Suggested rewrite:** "If your monthly API spend consistently exceeds $100, our Growth and Pro tiers offer 10-15% bonus credits and higher rate limits. For spend above $2,000/month, we negotiate custom pricing. Email service@riskmodels.app or upgrade directly from your dashboard."

### 5.5 OpenAPI Spec Pricing Annotations

Add `x-pricing` extension to each endpoint in the OpenAPI spec:

```yaml
paths:
  /api/ticker-returns:
    get:
      x-pricing:
        model: per_request
        cost_usd: 0.005
        billing_code: ticker_returns_v2
        free_tier: true
        estimate_endpoint: /api/estimate
```

This makes pricing discoverable by any OpenAPI-aware agent framework (LangChain, CrewAI, AutoGPT).

---

## 6. Quick Wins vs Long-Term Changes

### Quick Wins (1-2 weeks, minimal risk)

1. **Fix usage table on pricing page** — Replace token approximations with actual `cost_usd` values from capabilities.ts. Pure copy change, no backend work. (Recommendation 2.1, Path A partial)

2. **Add `_billing` to all response bodies** — ~20 lines in billing-middleware.ts. Huge agent-delight signal. (Recommendation 2.3)

3. **Publish `/api/pricing.json`** — ~30-line route that serializes CAPABILITIES pricing. (Recommendation 2.7)

4. **Add `X-Cache-Hit` header** — Surface cache status in billing headers. (Recommendation 2.8, partial)

5. **Rewrite FAQ answer on volume discounts** — Pure copy change. (Section 5.4)

6. **Add `x-pricing` to OpenAPI spec** — Documentation-only change. (Section 5.5)

### Medium-Term (1-2 months)

7. **Rebuild PricingEstimator** — Replace token-based calculator with endpoint-aware model. Frontend-only change. (Section 5.3)

8. **Convert portfolio-risk-index to per-position** — Change pricing model in capabilities.ts + update billing middleware. (Recommendation 2.4)

9. **Add session budget headers** — Redis counter + header parsing in middleware. (Recommendation 2.6)

10. **Implement batch volume discounts** — Tiered multiplier in `calculateRequestCost()`. (Section 4, batch-analysis)

### Long-Term (3-6 months)

11. **Build committed-spend tiers** — New DB schema, Stripe subscription integration, dashboard UI. (Recommendation 2.2)

12. **Self-serve enterprise dashboard** — Tier calculator, Stripe Checkout integration, automated provisioning. (Recommendation 2.5)

13. **Per-endpoint value-based pricing refinements** — Window-based scaling for correlations, query complexity scoring for CLI. (Section 4)

---

## Appendix: Current Pricing Summary (from capabilities.ts)

| Capability ID | Model | Cost | Billing Code |
|---|---|---|---|
| ticker-returns | per_request | $0.005 | ticker_returns_v2 |
| metrics | per_request | $0.001 | metrics_v3 |
| rankings | per_request | $0.001 | rankings_v3 |
| risk-decomposition | per_request | $0.010 | l3_decomp_v2 |
| chat-risk-analyst | per_token | $0.001/$0.002 per 1K | chat_risk_analyst_v2 |
| plaid-link-token | per_request | $0.000 | plaid_link_token_v1 |
| plaid-exchange-public-token | per_request | $0.000 | plaid_exchange_v1 |
| plaid-holdings | per_request | $0.010 | plaid_holdings_v1 |
| batch-analysis | per_position | $0.002 (min $0.01) | batch_analysis_v2 |
| ticker-search | per_request | $0.001 | ticker_search_v2 |
| health-status | per_request | $0.000 | health_check |
| telemetry-metrics | per_request | $0.002 | telemetry_v2 |
| metrics-snapshot | per_request | $0.001 | metrics_snapshot_v1 |
| l3-decomposition | per_request | $0.005 | l3_decomposition_v1 |
| portfolio-returns | per_position | $0.002 (min $0.01) | portfolio_returns_v1 |
| portfolio-risk-index | per_request | $0.005 | portfolio_risk_index_v1 |
| factor-correlation | per_request | $0.002 | factor_correlation_v1 |
| macro-factor-series | per_request | $0.001 | macro_factor_series_v1 |
| cli-query | per_request | $0.003 | cli_query_v1 |
