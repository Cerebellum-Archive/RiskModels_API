# Premium Tier Implementation Plan

**For: Cursor agent execution**  
**Context: Read `PREMIUM_TIER_DESIGN.md` first for full rationale and pricing decisions.**

---

## Plan overview (design ↔ implementation)

| Design doc migration | This document | Goal |
|---|---|---|
| Phase 1: Tag + transparency | **Phases 1, 3, 4, 5, 6** (and optional `X-Pricing-Tier` in Phase 1) | Add `tier`, expose it (`/api/estimate`, `/api/pricing`), refresh marketing UI — **no `cost_usd` changes** |
| Phase 2: Premium price adjustment | **Phase 2** | Raise premium `cost_usd`, bump `billing_code` versions, sync OpenAPI — **after** comms lead time |
| Phase 3: Launch PDF risk snapshot | **Phase 7** | New premium endpoint at $0.25; internal calls not double-billed |
| Phase 4: Expand premium catalog | Out of scope here | New endpoints + pricing rows as shipped |

**Suggested PR batching**

1. **Ship A (transparency):** Phase 1 + Phase 5 + Phase 6 + Phase 1.4–1.5. Keeps agents/docs in sync with live `cost_usd` while prices are still legacy.
2. **Ship B (marketing):** Phase 3 + Phase 4 — can follow Ship A in the same release or immediately after.
3. **Ship C (revenue):** Phase 2 only after **30-day customer notice** (see Step 2.0); then refresh Phase 3 table copy if any “current vs new” messaging was used.
4. **Ship D:** Phase 7 when the PDF pipeline is ready (BWMACRO templates + app route + cache).

**Route note:** The design mentions `/api/pricing.json`; in the App Router use `app/api/pricing/route.ts` → public **`GET /api/pricing`** (JSON). No separate `.json` path required unless you add a redirect for bookmarks.

---

## Phase 1: Add `tier` field to capabilities.ts (zero price changes)

### Step 1.1 — Update PricingModel interface

In `lib/agent/capabilities.ts`, add `tier` to the `PricingModel` interface:

```typescript
// BEFORE (line ~22)
export interface PricingModel {
  model: "per_request" | "per_token" | "per_position" | "subscription";
  cost_usd?: number;
  currency: "USD";
  billing_code: string;
  input_cost_per_1k?: number;
  output_cost_per_1k?: number;
  min_charge?: number;
}

// AFTER
export interface PricingModel {
  model: "per_request" | "per_token" | "per_position" | "subscription";
  tier: "baseline" | "premium";
  cost_usd?: number;
  currency: "USD";
  billing_code: string;
  input_cost_per_1k?: number;
  output_cost_per_1k?: number;
  min_charge?: number;
}
```

### Step 1.2 — Tag every capability with its tier

Add `tier` to the `pricing` object of every capability in the `CAPABILITIES` array. Use these exact assignments:

**Baseline endpoints** — add `tier: "baseline"`:
- `ticker-returns` (pricing.cost_usd: 0.005)
- `metrics` (0.001)
- `rankings` (0.001)
- `ticker-search` (0.001)
- `macro-factor-series` (0.001)
- `factor-correlation` (0.002)
- `telemetry-metrics` (0.002)
- `cli-query` (0.003)
- `metrics-snapshot` (0.001)
- `health-status` (0.000)
- `plaid-link-token` (0.000)
- `plaid-exchange-public-token` (0.000)

**Premium endpoints** — add `tier: "premium"`:
- `risk-decomposition` (0.01)
- `l3-decomposition` (0.005)
- `batch-analysis` (0.002/pos)
- `portfolio-returns` (0.002/pos)
- `portfolio-risk-index` (0.005)
- `plaid-holdings` (0.01)
- `chat-risk-analyst` (per_token)

**Do NOT change any `cost_usd` values in this step.** Tier tagging only.

Example of a tagged capability:

```typescript
{
  id: "ticker-returns",
  // ... name, description, endpoint, method, parameters ...
  pricing: {
    model: "per_request",
    tier: "baseline",          // <-- ADD THIS
    cost_usd: 0.005,
    currency: "USD",
    billing_code: "ticker_returns_v2",
  },
  // ... performance, confidence, tags ...
},
```

```typescript
{
  id: "portfolio-risk-index",
  // ...
  pricing: {
    model: "per_request",
    tier: "premium",           // <-- ADD THIS
    cost_usd: 0.005,           // keep current price for now
    currency: "USD",
    billing_code: "portfolio_risk_index_v1",
  },
  // ...
},
```

### Step 1.3 — Verify no billing logic breaks

After adding `tier` to all capabilities, verify:

1. `calculateRequestCost()` still works — it reads `cost_usd` directly and ignores unknown fields, so `tier` is purely additive metadata. No changes needed to this function.
2. `getCapabilityPricing()` returns the full PricingModel including `tier`.
3. Run `npx tsc --noEmit` to confirm no TypeScript errors from the required `tier` field being missing on any capability.

### Step 1.4 — Expose `tier` in cost estimator response

In `lib/agent/cost-estimator.ts`, include the `tier` field in the estimate response object. Find where the estimate response is assembled and add:

```typescript
tier: capability.pricing.tier,
```

alongside the existing `pricing_model`, `unit_cost_usd`, etc.

### Step 1.5 — Add `tier` to billing response headers (optional, low priority)

In `lib/agent/billing-middleware.ts`, add a response header:

```typescript
res.setHeader('X-Pricing-Tier', capability.pricing.tier);
```

alongside the existing `X-API-Cost-USD` and `X-Balance-Remaining` headers.

---

## Phase 2: Update premium prices

**This phase should be done AFTER Phase 1 ships and is verified in production.**

### Step 2.0 — Customer comms (required before flipping prices)

Per `PREMIUM_TIER_DESIGN.md` migration: email (or in-app notice to) active API key holders **at least 30 days** before the effective date. Include capability name, old → new `cost_usd`, and effective date. No change to baseline endpoints. After the date, deploy Step 2.1 the same day (or at 00:00 UTC per your policy).

### Step 2.1 — Bump premium endpoint prices

In `lib/agent/capabilities.ts`, update these capabilities' `pricing` objects:

| Capability ID | Old `cost_usd` | New `cost_usd` | Old `billing_code` | New `billing_code` |
|---|---|---|---|---|
| `risk-decomposition` | 0.01 | **0.02** | `l3_decomp_v2` | `l3_decomp_v3` |
| `l3-decomposition` | 0.005 | **0.02** | `l3_decomposition_v1` | `l3_decomposition_v2` |
| `portfolio-risk-index` | 0.005 | **0.03** | `portfolio_risk_index_v1` | `portfolio_risk_index_v2` |
| `batch-analysis` | 0.002 (per_position) | **0.005** | `batch_analysis_v2` | `batch_analysis_v3` |
| `portfolio-returns` | 0.002 (per_position) | **0.004** | `portfolio_returns_v1` | `portfolio_returns_v2` |
| `plaid-holdings` | 0.01 | **0.02** | `plaid_holdings_v1` | `plaid_holdings_v2` |

`chat-risk-analyst` — **no price change now**. Keep current token rates. Billing code stays `chat_risk_analyst_v2`.

Always bump the billing_code version when changing price so billing_events in Supabase have a clean audit trail (old events use v1/v2 codes, new events use bumped codes).

### Step 2.2 — Verify min_charge values

For per_position endpoints with updated unit costs:
- `batch-analysis`: min_charge stays at $0.01 (2 positions at $0.005 = $0.01, so min_charge is naturally met)
- `portfolio-returns`: min_charge stays at $0.01 (3 positions at $0.004 = $0.012 > min, so min_charge is fine)

No changes needed to min_charge.

---

## Phase 3: Update pricing page

### Step 3.1 — Replace token framing in `app/pricing/page.tsx`

**Replace the `usageRows` array** (lines ~19-37) with two arrays:

```typescript
const baselineRows = [
  { endpoint: "Risk metrics / rankings / search", cost: "$0.001", callsPer20: "20,000", tier: "baseline" as const },
  { endpoint: "Macro factors / correlations", cost: "$0.002", callsPer20: "10,000", tier: "baseline" as const },
  { endpoint: "CLI query", cost: "$0.003", callsPer20: "6,667", tier: "baseline" as const },
  { endpoint: "Ticker returns (any history length)", cost: "$0.005", callsPer20: "4,000", tier: "baseline" as const },
];

const premiumRows = [
  { endpoint: "L3 risk decomposition", cost: "$0.02", callsPer20: "1,000", tier: "premium" as const },
  { endpoint: "Plaid holdings sync", cost: "$0.02", callsPer20: "1,000", tier: "premium" as const },
  { endpoint: "Portfolio Risk Index", cost: "$0.03", callsPer20: "667", tier: "premium" as const },
  { endpoint: "Batch portfolio analysis", cost: "$0.005/pos", callsPer20: "varies", tier: "premium" as const },
  { endpoint: "AI risk analyst (chat)", cost: "~$0.003/turn", callsPer20: "~6,600", tier: "premium" as const },
  { endpoint: "PDF risk snapshot", cost: "$0.25", callsPer20: "80", tier: "premium" as const, comingSoon: true },
];
```

### Step 3.2 — Update hero card pricing

Replace the hero pricing display. Current (line ~155-159):

```tsx
<span className="text-4xl font-bold text-white tabular-nums">$20</span>
<span className="text-zinc-400 text-base">/ 1M tokens</span>
```

Replace with two-line pricing:

```tsx
<div className="space-y-0.5">
  <div className="flex items-baseline gap-2">
    <span className="text-sm font-medium text-zinc-400">Baseline</span>
    <span className="text-2xl font-bold text-white tabular-nums">$0.001</span>
    <span className="text-zinc-500 text-sm">/ request</span>
  </div>
  <div className="flex items-baseline gap-2">
    <span className="text-sm font-medium text-blue-400">Premium</span>
    <span className="text-2xl font-bold text-white tabular-nums">$0.02</span>
    <span className="text-zinc-500 text-sm">/ request</span>
  </div>
</div>
```

Remove the `= $0.000020 per token` line (line ~158-159).

### Step 3.3 — Replace usage table section

The existing single table (lines ~272-317) should become two tables with section headers:

```tsx
{/* Baseline table */}
<p className="text-xs font-semibold text-zinc-300 mb-2 uppercase tracking-widest">
  Baseline — Data Access
</p>
{/* table with columns: Endpoint | Cost per call | Calls per $20 */}
{/* render baselineRows */}

{/* spacer */}
<div className="mt-6 mb-2" />

{/* Premium table */}
<p className="text-xs font-semibold text-blue-400 mb-2 uppercase tracking-widest">
  Premium — Analytics & Deliverables
</p>
{/* same table structure, render premiumRows */}
{/* For comingSoon items, append "(coming soon)" in muted text after the endpoint name */}
```

### Step 3.4 — Update "Token usage" section header

Replace (line ~255-256):
```tsx
<SectionLabel>Token usage</SectionLabel>
<h2 className="text-xl font-bold text-white mb-1">
  How many tokens does a request use?
</h2>
```

With:
```tsx
<SectionLabel>Pricing</SectionLabel>
<h2 className="text-xl font-bold text-white mb-1">
  What does each endpoint cost?
</h2>
```

### Step 3.5 — Update the paragraph below the header

Replace the paragraph (lines ~259-264) that talks about "Token costs scale with complexity" and remove the Sparkles agentic marker references. New copy:

```tsx
<p className="text-sm text-zinc-400 mb-5 max-w-3xl leading-snug">
  Every endpoint has a flat per-request cost — no token math, no surprises.
  Use the estimator to model your monthly spend, then check the tables below
  for exact per-call pricing.
</p>
```

### Step 3.6 — Kill the footnote about tokens

Remove the footnote below the table (line ~319-322):
```tsx
<p className="mt-2 text-xs text-zinc-500 ...">
  Base rate: 1M tokens = $20. Token counts are per API call, not per ticker. Batch endpoints ...
</p>
```

Replace with:
```tsx
<p className="mt-2 text-xs text-zinc-500 max-w-4xl mx-auto leading-snug">
  All prices are per successful API call. Cached responses are free.
  Batch endpoints charge per position with a $0.01 minimum.
</p>
```

### Step 3.7 — Update FAQ volume discount answer

In the `faqs` array (line ~91-93), replace the volume discount answer:

```typescript
{
  q: "Is there a volume discount?",
  a: "If your monthly API spend consistently exceeds $100, email service@riskmodels.app — we can sharpen pricing for steady usage, raise rate limits (100+ req/min), and help you get integrated. We keep it straightforward.",
},
```

---

## Phase 4: Rebuild PricingEstimator

### Step 4.1 — Replace `components/pricing/PricingEstimator.tsx`

Replace the entire component. The new estimator should:

1. **Remove all token math.** Delete `USD_PER_MILLION_TOKENS` constant and `USE_CASES` array.

2. **Two sliders:**
   - "Baseline requests / month" — range 100 to 100,000, step 100, default 5,000
   - "Premium requests / month" — range 0 to 10,000, step 10, default 500

3. **Average cost selectors (optional, or just use sensible defaults):**
   - Baseline average cost: $0.002 (weighted average of typical baseline mix)
   - Premium average cost: $0.025 (weighted average of typical premium mix)

4. **Output panel:**
   - Baseline cost: `baselineRequests × 0.002`
   - Premium cost: `premiumRequests × 0.025`
   - **Total estimated monthly cost:** sum
   - Formula line: `(X baseline × $0.002 avg) + (Y premium × $0.025 avg)`
   - "Your first $20 in credits are free after card setup."

5. **Keep the same visual style** — rounded-xl, blue border/glow, zinc-900 background, etc.

---

## Phase 5: Add `/api/pricing` endpoint (machine-readable)

### Step 5.1 — Create `app/api/pricing/route.ts`

New API route that serializes the CAPABILITIES pricing for agent consumption:

```typescript
import { NextResponse } from "next/server";
import { CAPABILITIES } from "@/lib/agent/capabilities";

export async function GET() {
  const endpoints = CAPABILITIES.map((cap) => ({
    id: cap.id,
    name: cap.name,
    path: cap.endpoint,
    method: cap.method,
    tier: cap.pricing.tier,
    pricing_model: cap.pricing.model,
    cost_usd: cap.pricing.cost_usd ?? null,
    input_cost_per_1k: cap.pricing.input_cost_per_1k ?? null,
    output_cost_per_1k: cap.pricing.output_cost_per_1k ?? null,
    min_charge: cap.pricing.min_charge ?? null,
    billing_code: cap.pricing.billing_code,
  }));

  return NextResponse.json({
    version: "2026-04-01",
    currency: "USD",
    tiers: ["baseline", "premium"],
    endpoints,
    estimate_endpoint: "/api/estimate",
    docs: "https://riskmodels.app/pricing",
  }, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
```

This endpoint is public, free (no auth required, no billing), and cacheable.

---

## Phase 6: Update OpenAPI spec

### Step 6.1 — Document tier + pricing on each operation in `OPENAPI_SPEC.yaml`

For every billed path operation, add extensions consistent with `capabilities.ts`. Either:

- A single **`x-pricing`** object that includes `tier`, `model`, `cost_usd` (and token/position fields where relevant), **or**
- **`x-pricing-tier`** as a string plus existing `x-pricing` for cost — pick one style and use it everywhere.

Example (nested tier inside `x-pricing`):

```yaml
paths:
  /api/ticker-returns:
    get:
      x-pricing:
        tier: baseline
        model: per_request
        cost_usd: 0.005
      # ... existing spec ...

  /api/portfolio/risk-index:
    post:
      x-pricing:
        tier: premium
        model: per_request
        cost_usd: 0.03
      # ... existing spec ...
```

**Timing:** After Phase 1, values should match **current** production prices. Update again in Phase 2 when premium `cost_usd` and billing codes change.

If `x-pricing` blocks don't exist yet, add them. Use the appendix in `PREMIUM_TIER_DESIGN.md` as the target state after Phase 2; before Phase 2, use live `capabilities.ts` numbers.

---

## Verification checklist

After all phases:

- [ ] `npx tsc --noEmit` passes (no TypeScript errors from missing `tier` fields)
- [ ] Every capability in CAPABILITIES array has `tier: "baseline"` or `tier: "premium"`
- [ ] `GET /api/pricing` returns valid JSON with all endpoints and tiers
- [ ] Pricing page shows two tables (baseline/premium) with actual USD costs, not tokens
- [ ] PricingEstimator uses baseline/premium sliders, no token conversion
- [ ] Hero card shows "from $0.001 / request" and "from $0.02 / request", not "$20 / 1M tokens"
- [ ] No references to "tokens" remain on the pricing page (except in the chat endpoint row, which legitimately uses per-token billing)
- [ ] `calculateRequestCost()` still works identically (tier is metadata only)
- [ ] `/api/estimate` response includes `tier` field
- [ ] `X-Pricing-Tier` header appears in billed responses
- [ ] FAQ volume discount answer no longer references "10M+ tokens/month"
- [ ] OPENAPI_SPEC.yaml has `x-pricing` blocks with tier on all endpoints (updated again when Phase 2 lands)
- [ ] Phase 2: 30-day notice sent before price flip; billing_codes bumped per Step 2.1
- [ ] Phase 7 (when shipped): PDF routes billed once at $0.25; cache policy verified; no double-billing on internal data pulls

---

## Files touched (summary)

| File | Change type | Phase |
|---|---|---|
| `lib/agent/capabilities.ts` | Interface change + tag all capabilities | 1, 2 |
| `lib/agent/cost-estimator.ts` | Add `tier` to estimate response | 1 |
| `lib/agent/billing-middleware.ts` | Add `X-Pricing-Tier` header | 1 |
| `app/pricing/page.tsx` | Rewrite usage table, hero card, FAQ, copy | 3 |
| `components/pricing/PricingEstimator.tsx` | Full rewrite (remove tokens, add tier sliders) | 4 |
| `app/api/pricing/route.ts` | **New file** — machine-readable pricing manifest | 5 |
| `OPENAPI_SPEC.yaml` | Add `x-pricing` extensions to all endpoints | 6 |
| `app/api/.../risk-snapshot` (and metrics snapshot route) | New premium PDF/PNG/JSON handlers + cache | 7 |
| BWMACRO (external) | PDF templates / render skills | 7 |

---

## Related docs

- `PREMIUM_TIER_DESIGN.md` — Full rationale, endpoint classification, revenue modeling, PDF snapshot design brief
- `PRICING_STRATEGY_ANALYSIS.md` — Broader pricing strategy analysis and competitive context
- BWMACRO `docs/MONETIZATION_PLAN.md` — Revenue gaps and phased roadmap (token-era framing, to be updated after this ships)
- BWMACRO `.agents/skills/riskmodels-portfolio-hedge-analyst/SKILL.md` — Content template for the $0.25 PDF risk snapshot (Phase 3 of PREMIUM_TIER_DESIGN.md)

---

## Phase 7: PDF risk snapshot (flagship premium endpoint)

**Prerequisite:** BWMACRO skills/templates for PDF layout; headless render or `@react-pdf/renderer` (see design brief). **Billing:** single charge $0.25 (`risk_snapshot_pdf_v1`); internal fetches for metrics / L3 / PRI must not emit separate billed events. **Cache:** 24h keyed by positions + `as_of_date` + format.

### Step 7.1 — API surface

- **`POST /api/portfolio/risk-snapshot`** — JSON body per `PREMIUM_TIER_DESIGN.md` (`positions`, optional `title`, `as_of_date`, `format`: `pdf` | `png` | `json`). `Accept: application/pdf` for PDF.
- **`GET /api/metrics/{ticker}/snapshot.pdf`** — single-ticker convenience (or align path with existing metrics routes in this repo).

Register the route in **`CAPABILITIES`** as premium, `per_request`, `cost_usd: 0.25`, `billing_code: risk_snapshot_pdf_v1`, wire through **`billing-middleware`** like other capabilities.

### Step 7.2 — Implementation checklist

- [ ] Reuse internal services/helpers used by portfolio metrics (no duplicate HTTP round-trips that bill twice).
- [ ] Response headers: standard cost/balance headers + correct `Content-Type` for binary.
- [ ] Cache layer (24h); cache hit returns same body without re-charging (confirm policy matches `free-tier` / billing rules).
- [ ] Add row to pricing page tables; set `comingSoon: false` when live.
- [ ] Extend `GET /api/pricing` and OpenAPI `x-pricing` for the new paths.

### Step 7.3 — Free tier

Design default: shared 100 calls/day pool. Monitor abuse; if premium compute on free tier is material, implement split pools (design fallback).
