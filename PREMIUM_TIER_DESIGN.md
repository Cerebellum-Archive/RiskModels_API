# RiskModels API — Baseline / Premium Pricing Design

*April 2026 — Decisions locked*

---

## The Model

Two pricing tiers, both flat per-request. No tokens, no volume gates, no subscriptions. An agent or developer can call any endpoint and know the exact cost before the request lands.

| | Baseline | Premium |
|---|---|---|
| **Pricing model** | per_request (flat) | per_request (flat) |
| **Price range** | $0.001 – $0.005 | $0.02 – $0.25 |
| **What it covers** | Data access: lookups, time series, reference data, search | Computed analytics, rendered deliverables, external-data fetches with COGS |
| **Free tier** | Yes (shared pool, 100 calls/day) | Yes (same shared pool) |
| **Rate limits** | Same across tiers | Same across tiers |
| **Agent cost control** | `/estimate` returns exact cost + tier label | `/estimate` returns exact cost + tier label |

The key insight: both tiers stay `per_request` in capabilities.ts. The billing middleware doesn't change. The only difference is the `cost_usd` value and a new `tier` field on the capability definition.

---

## Decisions (Resolved)

| Question | Decision | Notes |
|---|---|---|
| Chat-risk-analyst tier? | **Premium** | Already premium-priced via per-token model. Label it premium for consistency. Exact token rates TBD — current $0.001/$0.002 per 1K stays for now. |
| Plaid holdings tier? | **Premium** | Real COGS (~$0.35/mo Plaid cost). Simple flat per-fetch pricing. |
| PDF risk snapshot price? | **$0.25** | Rendered deliverable, high value, replaces custom pipeline. |
| Rate limits differ by tier? | **No** | Same rate limits for baseline and premium. Enterprise gets custom limits on both. |

---

## Endpoint Classification

### Baseline Endpoints (data access — current pricing, unchanged)

| Endpoint | Price | Billing Code | Rationale |
|---|---|---|---|
| `metrics` / `metrics-snapshot` | $0.001 | metrics_v3 / metrics_snapshot_v1 | Single-row lookup |
| `rankings` | $0.001 | rankings_v3 | Pre-computed daily |
| `ticker-search` | $0.001 | ticker_search_v2 | Search/autocomplete |
| `macro-factor-series` | $0.001 | macro_factor_series_v1 | Read-only time series |
| `factor-correlation` | $0.002 | factor_correlation_v1 | Single computation, cached daily |
| `telemetry-metrics` | $0.002 | telemetry_v2 | Internal diagnostics |
| `cli-query` | $0.003 | cli_query_v1 | Raw SQL access |
| `ticker-returns` | $0.005 | ticker_returns_v2 | Time series with hedge ratios |
| `health-status` | $0.000 | health_check | Free |
| `plaid-link-token` | $0.000 | plaid_link_token_v1 | Free setup step |
| `plaid-exchange-public-token` | $0.000 | plaid_exchange_v1 | Free setup step |

These are the "infrastructure layer" — the data that agents and quants need to make decisions. Keeping them cheap drives adoption, API stickiness, and top-of-funnel conversion.

### Premium Endpoints (computed analytics + COGS-bearing)

| Endpoint | Current Price | Premium Price | Billing Code | Rationale |
|---|---|---|---|---|
| `portfolio-risk-index` | $0.005 | **$0.03** | portfolio_risk_index_v2 | Multi-position variance decomposition. Currently massively underpriced relative to value delivered. |
| `risk-decomposition` (L3) | $0.01 | **$0.02** | l3_decomp_v3 | Full 3-level hierarchical decomposition. Most compute-intensive single-ticker endpoint. |
| `l3-decomposition` | $0.005 | **$0.02** | l3_decomposition_v2 | Same model, alternate endpoint path. Align pricing. |
| `batch-analysis` | $0.002/pos (min $0.01) | **$0.005/pos** (min $0.01) | batch_analysis_v3 | Comprehensive multi-position risk + hedge recs. Keep per_position model, raise unit cost. |
| `plaid-holdings` | $0.01 | **$0.02** | plaid_holdings_v2 | External brokerage data via Plaid. Real COGS (~$0.35/mo per connection). Simple per-fetch premium. |
| `chat-risk-analyst` | $0.001/$0.002 per 1K | **$0.001/$0.002 per 1K** (label as premium, keep current token rates) | chat_risk_analyst_v2 | LLM costs are inherently premium. Per-token model naturally scales with complexity. Rates TBD for future adjustment. |
| `portfolio-returns` | $0.002/pos (min $0.01) | **$0.004/pos** (min $0.01) | portfolio_returns_v2 | Batch fetch returns for multiple tickers. Moderate compute, portfolio-class endpoint. |

### Future Premium Endpoints (planned)

| Endpoint | Price | Billing Code | Description | Status |
|---|---|---|---|---|
| `portfolio/risk-snapshot.pdf` | **$0.25** | risk_snapshot_pdf_v1 | Rendered one-page PDF risk report: factor exposures, hedge ratios, PRI chart, sector decomposition. Replaces custom PDF pipelines. | **Build next** — first "obviously premium" endpoint. Skills being developed in BWMACRO. |
| `portfolio/stress-test` | **$0.05 – $0.10** | stress_test_v1 | Historical stress scenario analysis (COVID, GFC, taper tantrum, etc.) applied to a portfolio. | Planned |
| `risk-report/comprehensive` | **$0.25 – $0.50** | risk_report_v1 | Multi-page PDF or structured JSON: full risk audit with commentary, factor attribution, peer comparison, hedge recommendations. | Planned |
| `portfolio/optimization` | **$0.10 – $0.25** | portfolio_opt_v1 | Suggested weight adjustments to minimize risk or maximize risk-adjusted return within constraints. | Planned |
| `alerts/risk-threshold` | **$0.01/alert/day** | risk_alert_v1 | Persistent monitoring: notify when a position's risk metrics cross a threshold. | Planned |

---

## PDF Risk Snapshot — Design Brief

The PDF risk snapshot is the premium tier's flagship launch endpoint. It turns raw API data into a polished, client-ready deliverable.

### What it produces

A single-page PDF containing:

- **Header**: Ticker or portfolio name, date, RiskModels branding
- **Factor exposure chart**: L1/L2/L3 explained risk as stacked bar or waterfall
- **Hedge ratio table**: L1/L2/L3 hedge ratios with ETF labels
- **PRI gauge or time series**: Portfolio Risk Index (if portfolio endpoint)
- **Sector decomposition**: Pie or treemap of sector/subsector risk contribution
- **Key metrics summary**: Volatility, explained risk %, R-squared, top factor exposures
- **Footer**: Methodology link, data timestamp, "Powered by RiskModels"

### API design

```
POST /api/portfolio/risk-snapshot
Content-Type: application/json
Accept: application/pdf

{
  "positions": [
    { "ticker": "AAPL", "weight": 0.25 },
    { "ticker": "NVDA", "weight": 0.20 },
    { "ticker": "MSFT", "weight": 0.15 },
    ...
  ],
  "title": "Q2 2026 Growth Portfolio",    // optional
  "as_of_date": "2026-04-01",             // optional, default latest
  "format": "pdf"                          // pdf | png | json (structured data only)
}
```

Response: Binary PDF (Content-Type: application/pdf) with billing headers.

For single-ticker snapshots:
```
GET /api/metrics/{ticker}/snapshot.pdf
```

### Implementation notes

- PDF generation: use a headless rendering approach (Puppeteer/Playwright rendering a React template to PDF, or a library like `@react-pdf/renderer` for server-side generation)
- The underlying data calls (metrics, L3 decomp, PRI) are internal — they should NOT be double-billed. The $0.25 covers the full bundle.
- Cache rendered PDFs for 24 hours (data updates daily anyway). Serve cached PDF for free on re-request within the same day.
- Skills for PDF generation and risk report templates are being developed in the BWMACRO monorepo.

### Why $0.25

- It bundles 3-5 internal API calls worth ~$0.05-$0.08 of baseline data
- PDF rendering has real compute cost (headless browser or templating engine)
- The deliverable replaces a custom reporting pipeline that would cost a developer hours to build
- At $0.25, a user generating 100 monthly client reports pays $25/mo — extremely reasonable compared to any alternative
- Bloomberg PORT's PDF reports are part of a $24K+/year terminal license. $0.25 per report is a 100x cost reduction.

---

## Implementation in capabilities.ts

### Interface change

```typescript
export interface PricingModel {
  model: "per_request" | "per_token" | "per_position" | "subscription";
  tier: "baseline" | "premium";    // NEW — required on all capabilities
  cost_usd?: number;
  currency: "USD";
  billing_code: string;
  input_cost_per_1k?: number;
  output_cost_per_1k?: number;
  min_charge?: number;
}
```

### What doesn't change

- `calculateRequestCost()` — reads `cost_usd` directly; tier is metadata only
- `billing-middleware.ts` — the billing pipeline is tier-agnostic; it just deducts `cost_usd`
- `billing.ts` — balance management doesn't care about tiers
- `free-tier.ts` — shared pool, no tier-specific limits (for now)
- Database schema — `billing_events` already stores `capability_id` and `cost_usd`
- Rate limits — same across tiers per decision above

### What changes

| File | Change | Effort |
|---|---|---|
| `lib/agent/capabilities.ts` | Add `tier` field to `PricingModel` interface. Tag all capabilities. Update `cost_usd` on premium endpoints. Bump billing codes. | Small |
| `app/pricing/page.tsx` | Replace token usage table with baseline/premium split table showing actual `cost_usd` values. Kill the token framing. | Medium |
| `components/pricing/PricingEstimator.tsx` | Replace token-based estimator with tier-aware endpoint picker. Two sliders (baseline req/mo + premium req/mo). | Medium |
| `lib/agent/cost-estimator.ts` | Include `tier` in estimate response. | Small |
| `/api/pricing.json` (new route) | Serialize CAPABILITIES pricing with tier field. ~30 lines. | Small |
| `OPENAPI_SPEC.yaml` | Add `x-pricing-tier` extension to each endpoint. | Small |
| New endpoint: `POST /api/portfolio/risk-snapshot` | Full implementation of PDF risk snapshot. | Large |

---

## Pricing Page Design

### Hero Card

```
Pay-as-You-Go

Baseline: from $0.001 / request
Premium:  from $0.02 / request
──────────────────────────────────
All endpoints. Flat per-request pricing.
No tokens. No volume gates. No surprises.
```

### Split Usage Tables

**Baseline — Data Access**

| Endpoint | Cost per call | Calls per $20 |
|---|---|---|
| Risk metrics / rankings / search | $0.001 | 20,000 |
| Macro factors / correlations | $0.002 | 10,000 |
| CLI query | $0.003 | 6,667 |
| Ticker returns (any history length) | $0.005 | 4,000 |

**Premium — Analytics & Deliverables**

| Endpoint | Cost per call | Calls per $20 |
|---|---|---|
| Plaid holdings sync | $0.02 | 1,000 |
| L3 risk decomposition | $0.02 | 1,000 |
| Portfolio Risk Index | $0.03 | 667 |
| Batch portfolio analysis | $0.005 / position | varies |
| AI risk analyst (chat) | ~$0.003 / turn | ~6,600 |
| PDF risk snapshot | $0.25 | 80 |

### Suggested tagline

**"Data access from $0.001. Portfolio analytics from $0.02. Both flat per-request."**

---

## Migration Path

### Phase 1: Tag + transparency (zero user impact, 1-2 weeks)

1. Add `tier` field to `PricingModel` interface in capabilities.ts
2. Tag all existing capabilities as baseline or premium (at current prices)
3. Ship `/api/pricing.json` endpoint exposing tier metadata
4. Update `/api/estimate` responses to include `tier`
5. Update pricing page: replace token table with actual `cost_usd` split by tier
6. Rebuild PricingEstimator with tier-aware model

**User impact:** None. Prices unchanged. Just better transparency.

### Phase 2: Premium price adjustment (announce 30 days ahead, then flip)

1. Email all active API key holders: "In 30 days, these endpoints move to premium pricing: [list with old → new prices]"
2. On effective date, update `cost_usd` values in capabilities.ts for premium endpoints
3. Bump billing codes (e.g., `portfolio_risk_index_v1` → `portfolio_risk_index_v2`) for clean audit trail
4. Update OpenAPI spec with new prices

**User impact:** Price increases on 5-6 endpoints. Baseline endpoints unaffected. Most users' total spend increases modestly because premium calls are a minority of total volume.

### Phase 3: Launch PDF risk snapshot

1. Build the endpoint (skills in BWMACRO, rendering pipeline, caching layer)
2. Ship as the first "born premium" endpoint at $0.25
3. Market it as the anchor for the premium tier
4. This validates premium pricing with a new capability (no optics of "price hike")

### Phase 4: Expand premium catalog

Stress testing, comprehensive reports, portfolio optimization, risk alerts — each launched as a new premium endpoint with its own `cost_usd`.

---

## Free Tier

**Decision: Shared pool (Option A).**

100 calls/day, same pool for baseline and premium. A free-tier user could burn all 100 calls on $0.25 PDF snapshots ($25 in premium compute on the free tier), but this is an edge case — free-tier users are experimenting, not generating 100 PDF reports a day.

If premium free-tier abuse becomes material (>5% of total compute costs), switch to split pools: 100 baseline + 10 premium calls/day.

---

## Revenue Impact Modeling

### Current state (illustrative)

Assume a typical active paid user makes 5,000 calls/month with 80% baseline, 20% portfolio/premium endpoints:

- 4,000 baseline calls × $0.002 avg = $8.00
- 1,000 premium calls × $0.005 avg (current prices) = $5.00
- **Total: $13.00/mo per active user**

### After premium pricing

Same usage pattern, premium prices applied:

- 4,000 baseline calls × $0.002 avg = $8.00
- 800 analytics calls × $0.025 avg = $20.00
- 100 PDF snapshots × $0.25 = $25.00
- 100 chat turns × $0.003 avg = $0.30
- **Total: $53.30/mo per active user** (4.1x increase)

This is a best-case illustration — not all premium users will adopt PDF snapshots. A more conservative estimate with just the analytics price increases (no PDF):

- 4,000 baseline × $0.002 = $8.00
- 1,000 premium × $0.025 avg = $25.00
- **Total: $33.00/mo** (2.5x increase)

---

## Appendix: Full Endpoint Pricing Map

| Capability ID | Tier | Model | Price | Billing Code |
|---|---|---|---|---|
| metrics | baseline | per_request | $0.001 | metrics_v3 |
| metrics-snapshot | baseline | per_request | $0.001 | metrics_snapshot_v1 |
| rankings | baseline | per_request | $0.001 | rankings_v3 |
| ticker-search | baseline | per_request | $0.001 | ticker_search_v2 |
| macro-factor-series | baseline | per_request | $0.001 | macro_factor_series_v1 |
| factor-correlation | baseline | per_request | $0.002 | factor_correlation_v1 |
| telemetry-metrics | baseline | per_request | $0.002 | telemetry_v2 |
| cli-query | baseline | per_request | $0.003 | cli_query_v1 |
| ticker-returns | baseline | per_request | $0.005 | ticker_returns_v2 |
| health-status | baseline | per_request | $0.000 | health_check |
| plaid-link-token | baseline | per_request | $0.000 | plaid_link_token_v1 |
| plaid-exchange-public-token | baseline | per_request | $0.000 | plaid_exchange_v1 |
| risk-decomposition | **premium** | per_request | **$0.02** | l3_decomp_v3 |
| l3-decomposition | **premium** | per_request | **$0.02** | l3_decomposition_v2 |
| portfolio-risk-index | **premium** | per_request | **$0.03** | portfolio_risk_index_v2 |
| batch-analysis | **premium** | per_position | **$0.005/pos** (min $0.01) | batch_analysis_v3 |
| portfolio-returns | **premium** | per_position | **$0.004/pos** (min $0.01) | portfolio_returns_v2 |
| plaid-holdings | **premium** | per_request | **$0.02** | plaid_holdings_v2 |
| chat-risk-analyst | **premium** | per_token | $0.001/$0.002 per 1K | chat_risk_analyst_v2 |
| *risk-snapshot.pdf* | **premium** | per_request | **$0.25** | risk_snapshot_pdf_v1 |
