# Compass Demo

One-command demo of Compass analyzing a real product (SyncFlow) across 5 evidence sources.

## Quick Start

```bash
# Set your API key
export ANTHROPIC_API_KEY=sk-ant-...

# Install Compass
cd engine && pip install -e .

# Run the demo (one command!)
compass demo
```

This runs the full pipeline in ~60 seconds:
1. Creates a temp workspace for SyncFlow
2. Connects 5 evidence sources (code, strategy docs, analytics, interviews, support tickets)
3. Ingests all evidence into the knowledge graph
4. **Reconciles** — finds where sources of truth disagree
5. **Discovers** — synthesizes ranked product opportunities
6. **Specifies** — generates an agent-ready feature spec for the #1 opportunity

Use `compass demo --skip-spec` for a faster demo (~30 seconds) that skips spec generation.

## The Story

SyncFlow is a real-time integration platform. The demo data tells a compelling story:

- **Strategy** claims real-time sync is their moat: "the most technically advanced sync system in the market"
- **Code** reveals a polling-based sync engine with reduced retries and unscaled connection pool
- **Analytics** show sync latency increased 5x and failures increased 8x over 8 months
- **Interviews** have customers saying sync is broken — "I've started using Dropbox as a backup"
- **Support** has 25 tickets, mostly about sync failures and missing enterprise features

Compass surfaces the conflict: *"Your strategy says sync is your competitive advantage, but your code, data, and customers say it's degrading."*

## Expected Findings

**Conflicts:**
- Code vs Docs: Strategy promises sub-5s real-time sync; code uses 5-second polling with 1 retry
- Docs vs Data: "Industry-leading" sync success claimed; actual rate is 87.3%
- Code vs Judgment: Users need monitoring; code only logs to stdout

**Opportunities:**
1. Fix sync reliability — High confidence, all 4 sources agree
2. Add sync health monitoring — Enterprise customers blocking on this
3. Ship SSO — Blocking enterprise renewals
4. Simplify onboarding — 40% first-session drop-off

## Recording a Demo

```bash
# Install asciinema
pip install asciinema

# Record
bash record_demo.sh

# Convert to GIF
pip install agg
agg compass-demo.cast compass-demo.gif --speed 2
```

## Alternative: Step-by-Step

For a manual walkthrough, use `run_demo.sh`:

```bash
cd demo && bash run_demo.sh
```

## Sample Data

| Directory | Source Type | Contents |
|-----------|-----------|----------|
| `code/` | CODE | SyncFlow engine source, README |
| `strategy/` | DOCS | Product strategy, roadmap |
| `analytics/` | DATA | Usage metrics CSV, feature adoption CSV |
| `interviews/` | JUDGMENT | 3 customer interview transcripts |
| `support/` | JUDGMENT | 25 support tickets CSV |

All outputs are saved to `.compass/output/`:
- `conflict-report.md` — Where your sources of truth disagree
- `opportunities.md` — Ranked, evidence-grounded product opportunities
- `spec-*.md` — Agent-ready feature specifications
