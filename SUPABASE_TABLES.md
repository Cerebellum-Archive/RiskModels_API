# Supabase Tables (RiskModels Backend)

Quick reference for Supabase tables used by the RiskModels API and platform. For authentication and direct DB access (Mode 2 / Mode 3), see [AUTHENTICATION_GUIDE.md](AUTHENTICATION_GUIDE.md).

**Source of truth:** The [Risk_Models](https://github.com/Cerebellum-Archive/Risk_Models) repo defines and migrates these tables. This doc is kept in sync for API and CLI consumers.

---

## API & risk data

| Table | Purpose |
|-------|---------|
| `ticker_factor_metrics` | Latest risk metrics per ticker (HR/ER, vol, sector); RLS for paid access |
| `ticker_factor_metrics_free` | View for free-tier subset |
| `ticker_metadata` | Ticker symbols, names, sector/ETF mappings |
| `erm3_ticker_returns` | Per-ticker return series (ticker, date) |
| `erm3_l3_decomposition` | L1/L2/L3 hedge and explained-risk history (e.g. monthly) |
| `erm3_time_index` | Trading date grid |
| `erm3_etf_returns` | ETF return series |
| **`erm3_betas`** | Factor betas per ticker/date (or latest); synced from ERM3/Zarr |
| **`erm3_rankings`** | Ticker rankings (e.g. risk, factor exposure) for screening and API |

---

## Billing & agents

| Table | Purpose |
|-------|---------|
| `agent_accounts`, `agent_api_keys` | Agent keys and provisioning |
| `billing_events`, `agent_invoices`, `balance_top_ups` | Billing and prepaid balance |
| `user_generated_api_keys` | User-generated API keys (dashboard) |

---

## Internal

| Table | Purpose |
|-------|---------|
| `ticker_request_logs` | Request logging / analytics |

---

When Risk_Models adds or renames tables, update this file and the table list in [AUTHENTICATION_GUIDE.md](AUTHENTICATION_GUIDE.md). The sync script `sync-mcp-from-risk-models.sh` reminds maintainers to keep these docs in sync.
