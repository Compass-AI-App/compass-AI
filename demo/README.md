# Compass Demo: SyncFlow Product Discovery

This demo shows the full Compass product discovery loop against a fictional product called **SyncFlow** — a real-time sync platform for teams.

## The Scenario

SyncFlow is a growing product with clear symptoms of product-market friction:
- **Code** reveals technical debt (polling instead of WebSocket, no retries, undersized connection pool)
- **Strategy docs** promise real-time sync and enterprise features
- **Usage data** shows degrading latency and increasing churn
- **Customer interviews** confirm frustration with sync reliability
- **Support tickets** cluster around sync failures, latency, and missing enterprise features

Compass ingests all of this, finds where the sources disagree, and surfaces evidence-grounded opportunities.

## Expected Findings

When you run the demo, Compass should surface conflicts like:
- **Code vs Docs**: Strategy promises real-time sync, but code uses 5-second polling with no retries
- **Docs vs Data**: Strategy prioritizes "Developer API" but there's zero usage of API features (because it doesn't exist yet), while sync latency is actively causing churn
- **Code vs Judgment**: Users need sync health monitoring but the code has only basic "is alive" checks

And opportunities like:
1. **Fix sync reliability** — High confidence, multi-source signal (code debt + data degradation + user complaints)
2. **Add sync health monitoring** — Enterprise customers explicitly requesting it
3. **Ship SSO** — Blocking enterprise renewals
4. **Simplify onboarding** — 40% first-session drop-off

## Running the Demo

### Prerequisites

```bash
# Install Compass
cd /path/to/compass-AI
pip install -e .

# Set your API key
export ANTHROPIC_API_KEY=sk-ant-...
```

### Quick Run

```bash
cd demo
bash run_demo.sh
```

### Step-by-Step

```bash
# Create a workspace
mkdir workspace && cd workspace

# Initialize
compass init "SyncFlow" -d "Real-time sync platform for teams"

# Connect all evidence sources
compass connect github --path ../sample_data/code --name "codebase"
compass connect docs --path ../sample_data/strategy --name "strategy"
compass connect analytics --path ../sample_data/analytics --name "metrics"
compass connect interviews --path ../sample_data/interviews --name "interviews"
compass connect support --path ../sample_data/support --name "tickets"

# Ingest
compass ingest

# Find conflicts between sources
compass reconcile

# Discover opportunities
compass discover

# Generate a spec for the top opportunity
compass specify "Fix sync reliability"
```

### Output

All outputs are saved to `.compass/output/`:
- `conflict-report.md` — Where your sources of truth disagree
- `opportunities.md` — Ranked, evidence-grounded product opportunities
- `spec-*.md` — Agent-ready feature specifications

## Sample Data Overview

| Source | Files | What It Represents |
|--------|-------|--------------------|
| `code/` | `sync_engine.py`, `README.md` | Technical reality — what the code actually does |
| `strategy/` | `product-strategy.md`, `roadmap.md` | What leadership expects — priorities and plans |
| `analytics/` | `usage_metrics.csv`, `feature_usage.csv` | Empirical data — what's actually happening |
| `interviews/` | 3 customer interviews | User voice — what customers need and feel |
| `support/` | `support_tickets.csv` (23 tickets) | User pain — what's breaking and frustrating |
