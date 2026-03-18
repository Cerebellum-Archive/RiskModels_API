# BWMACRO — AI Agent Instructions

This repo is the **single source of truth for AI instructions** across three related repos. When editing schemas, OpenAPI specs, MCP data, or tracking docs, follow the cross-repo sync rules below.

---

## Cross-Repo Sync Rules (Always Enforce)

When editing schemas, paths, or docs: **plan cross-repo impact first** and **ALWAYS list manual sync steps** in your response.

### 1. Canonical Schemas in RiskModels_API

JSON schemas (e.g. `estimate-v1.json`) are canonical **only** in `RiskModels_API/mcp-server/data/schemas/`. Create and edit them there.

### 2. Copy New Schemas to Risk_Models

After adding a schema in RiskModels_API, manually copy to Risk_Models:

```bash
cp RiskModels_API/mcp-server/data/schemas/NEW_SCHEMA.json \
   Risk_Models/riskmodels_com/mcp-server/data/schemas/
```

### 3. Update schema-paths.json in BOTH Repos

Add the new schema path to `schema-paths.json` in:

- `RiskModels_API/mcp-server/data/schema-paths.json`
- `Risk_Models/riskmodels_com/mcp-server/data/schema-paths.json`

### 4. Changelog in RiskModels_API

Add an entry to `RiskModels_API/CHANGELOG.md` for new endpoints, schemas, or format params.

### 5. Update current_state.md in BWMACRO

When adding formats (e.g. Parquet/CSV), new endpoints, or closing gaps, update `docs/api_roadmap/current_state.md`:

- Response Format section
- Data Endpoints table (Format column)
- Known Gaps (strikethrough completed items)

### 6. Broadcast to User-Visible Sources

When API changes ship, run the **API Broadcast Checklist** in `docs/api_roadmap/API_BROADCAST_PROCESS.md`:

- Colab notebook (Risk_Models canonical)
- erm3.md and web docs
- CHANGELOG, current_state

---

## Cursor Config Sync (BWMACRO → RiskModels_API, Risk_Models)

`.cursor/rules/`, `.agents/skills/`, and `AGENTS.md` are synced automatically:

- **GitHub Actions:** Push to BWMACRO `main` (when those paths change) triggers `.github/workflows/sync-cursor-config.yml`, which pushes to both repos. Requires `REPO_ACCESS_TOKEN` secret in BWMACRO.
- **Fallback script:** `./scripts/sync-cursor-config.sh` — run locally when testing before push. Expects RiskModels_API and Risk_Models as sibling dirs of BWMACRO.

---

## Related Config

- **Cursor rule:** `.cursor/rules/repo-sync-enforcer.mdc` — applies when editing `*.json`, `OPENAPI_SPEC.yaml`, `schema-paths.json`, `CHANGELOG.md`, `current_state.md`
- **Skill:** `.agents/skills/repo-sync/SKILL.md` — invoke with `@repo-sync-enforcer` for step-by-step sync workflow

---

## Repo Roles

| Repo | Role |
|------|------|
| **BWMACRO** | High-level docs, current_state.md, next_steps.md, tracking |
| **RiskModels_API** | Canonical: OPENAPI_SPEC.yaml, mcp-server/schemas/*.json, schema-paths.json, examples/, CHANGELOG.md |
| **Risk_Models** | MCP consumer: copies of schemas, mcp-server/data/schemas/, schema-paths.json |
