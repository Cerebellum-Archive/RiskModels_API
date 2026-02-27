# RiskModels Platform

[![npm version](https://badge.fury.io/js/riskmodels-cli.svg)](https://badge.fury.io/js/riskmodels-cli)
[![Live Docs](https://img.shields.io/badge/Live%20Docs-riskmodels.net%2Fdocs%2Fcli-6366f1)](https://riskmodels.net/docs/cli)
[![Interactive API](https://img.shields.io/badge/API%20Docs-riskmodels.net%2Fdocs%2Fapi%2Ferm3-6366f1)](https://riskmodels.net/docs/api/erm3)

**Agent-ready CLI and API for equity risk models, factor metrics, and hedge ratios.**

- **CLI**: `npm install -g riskmodels-cli` - Command-line access to risk models
- **API**: `https://riskmodels.net/api` - HTTP endpoints for programmatic access
- **Interactive Docs**: [riskmodels.net/docs/cli](https://riskmodels.net/docs/cli)
- **OpenAPI Spec**: [riskmodels.net/docs/api/erm3](https://riskmodels.net/docs/api/erm3)

---

## 🚀 Quick Start (CLI - Recommended)

The RiskModels CLI is the fastest way to access risk model data from your terminal or AI agents.

### Install the CLI

```bash
npm install -g riskmodels-cli
```

### Get a Free API Key (No Payment Required)

```bash
curl -X POST https://riskmodels.net/api/auth/provision-free \
  -H "Content-Type: application/json" \
  -d '{"agent_name": "my-agent"}'

# Returns: rm_agent_free_xxxxxxxxxxxx
```

### Configure the CLI

```bash
riskmodels config set apiKey rm_agent_free_xxxxxxxxxxxx
```

### Test It Out

```bash
# Query risk metrics for AAPL
riskmodels query "SELECT ticker, l3_market_hr, volatility FROM ticker_factor_metrics WHERE ticker = 'AAPL' LIMIT 1"

# Expected output:
# ✓ Results: 1 row
# Cost: $0.00 | Tier: free | Used Today: 1/100
# {"ticker": "AAPL", "l3_market_hr": -1.49, "volatility": 0.316}
```

### Use with AI Agents

Generate a tool manifest for your AI agent:

```bash
# For Claude Desktop
riskmodels manifest --format anthropic > claude-tools.json

# For Zed Editor
riskmodels manifest --format zed > zed-tools.json

# For OpenAI GPTs
riskmodels manifest --format openai > openai-tools.json
```

**Free Tier Limits**: 100 queries/day, 10 queries/minute  
**Paid Tier**: $0.003/query, no daily limits

**Full CLI Documentation**: See [CLI_COMMAND_TESTING.md](./CLI_COMMAND_TESTING.md) for comprehensive examples.

---

## 📊 API Quick Start (Alternative)

If you prefer direct HTTP API access:

### TypeScript

```typescript
const resp = await fetch("https://riskmodels.net/api/metrics/NVDA", {
  headers: { Authorization: "Bearer rm_agent_live_..." },
});
const m = await resp.json();

console.log("SPY hedge:", m.l3_market_hr);        // e.g. 1.28
console.log("Residual risk:", m.l3_residual_er);  // e.g. 0.54 (54% idiosyncratic)
console.log("Volatility:", m.volatility);         // e.g. 0.048 (48% annualized)
```

### Python

```python
import requests

API_KEY = "rm_agent_live_..."
HEADERS = {"Authorization": f"Bearer {API_KEY}"}

# Get latest metrics for NVDA
m = requests.get("https://riskmodels.net/api/metrics/NVDA", headers=HEADERS).json()

print(f"Market Hedge:   {m['l3_market_hr']:.2f}")     # 1.28
print(f"Residual Risk:  {m['l3_residual_er']:.1%}")   # 54.0%
print(f"Volatility:     {m['volatility']:.1%}")       # 48.0%
```

### cURL

```bash
curl -X GET "https://riskmodels.net/api/metrics/NVDA" \
  -H "Authorization: Bearer rm_agent_live_..."
```

---

## 📦 Installation Options

### Option 1: Install CLI (Recommended for developers & agents)

```bash
npm install -g riskmodels-cli
```

Then:
```bash
# Get free key
curl -X POST https://riskmodels.net/api/auth/provision-free ...

# Configure
riskmodels config set apiKey rm_agent_free_xxx

# Use
riskmodels query "SELECT * FROM ticker_metadata LIMIT 5"
```

### Option 2: Direct API Access (For applications)

```bash
# Install Python requests
pip install requests

# Or Node.js
npm install node-fetch

# Then use HTTP endpoints directly
```

---

## 💻 CLI Usage Examples

### Single ticker analysis
```bash
riskmodels query "SELECT ticker, volatility, l3_residual_er FROM ticker_factor_metrics WHERE ticker = 'NVDA' LIMIT 1"
```

### Multi-ticker comparison
```bash
riskmodels query "SELECT ticker, l3_market_hr, volatility FROM ticker_factor_metrics WHERE ticker IN ('AAPL', 'MSFT', 'NVDA')"
```

### Screen with conditions
```bash
riskmodels query "SELECT ticker, volatility FROM ticker_factor_metrics WHERE volatility < 0.03 ORDER BY volatility ASC LIMIT 10"
```

### JSON output (for scripting)
```bash
riskmodels --json query "SELECT ticker, market_cap FROM ticker_metadata WHERE market_cap > 1000000000000"
```

---

## 📁 Repository Structure

```
RiskModels_API/
├── cli/                          # CLI-related documentation
├── examples/
│   ├── python/                   # Python API examples
│   ├── typescript/               # TypeScript API examples
│   └── cli/                      # CLI usage examples
├── docs/
│   ├── CLI_COMMAND_TESTING.md    # Comprehensive CLI tests
│   ├── API_ENDPOINT_TESTING.md   # API test examples
│   └── PHASE_*.md               # Implementation phases
├── AUTHENTICATION_GUIDE.md       # Auth details
├── RESPONSE_METADATA.md          # Response formats
├── ERROR_SCHEMA.md              # Error handling
├── SEMANTIC_ALIASES.md          # Field definitions
├── VALIDATION_HELPERS.md        # Data validation
├── OPENAPI_SPEC.yaml           # OpenAPI 3.0.3 spec
└── README.md                   # This file
```

---

## 🔐 Authentication

### For CLI
```bash
riskmodels config set apiKey rm_agent_free_xxx  # or rm_agent_live_xxx
```

### For API
```bash
# In request header
curl -H "Authorization: Bearer rm_agent_free_xxx" https://riskmodels.net/api/metrics/NVDA
```

---

## 🔧 Tools & References

### CLI Documentation
- **Testing Guide**: [CLI_COMMAND_TESTING.md](./CLI_COMMAND_TESTING.md)
- **API Examples**: [API_ENDPOINT_TESTING.md](./API_ENDPOINT_TESTING.md)

### API Documentation
- **OpenAPI Spec**: [OPENAPI_SPEC.yaml](./OPENAPI_SPEC.yaml)
- **Response Format**: [RESPONSE_METADATA.md](./RESPONSE_METADATA.md)
- **Error Handling**: [ERROR_SCHEMA.md](./ERROR_SCHEMA.md)

### Implementation
- **Phase 1 Complete**: [PHASE_1_COMPLETE.md](./PHASE_1_COMPLETE.md)
- **Phase 3 Complete**: [PHASE_3_COMPLETE.md](./PHASE_3_COMPLETE.md)

---

## 💰 Pricing

| Tier | Cost | Queries | Rate Limit |
|------|------|---------|------------|
| **Free** | $0.00 | 100/day | 10/minute |
| **Paid** | $0.003/query | Unlimited | 60/minute |

**Billing**: Prepaid via Stripe. Top up at https://riskmodels.net/settings

---

## 🤝 Support

- **CLI Docs**: https://riskmodels.net/docs/cli
- **API Docs**: https://riskmodels.net/docs/api/erm3
- **Issues**: https://github.com/Cerebellum-Archive/RiskModels_API/issues
- **Email**: api-support@riskmodels.net
- **Status**: https://riskmodels.net/status

---

## 📄 License

MIT

---

**Last Updated**: February 27, 2026  
**CLI Version**: 1.0.0  
**API Version**: 1.0.0
