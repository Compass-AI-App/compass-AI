# Compass — YC Positioning

## One-Liner

Cursor for Product Managers: AI-native product discovery that turns raw evidence into agent-ready specifications.

## The Problem

Over the last two years, AI coding tools (Cursor, Claude Code, GitHub Copilot) have dramatically accelerated *how* teams build software. But they all assume someone has already figured out *what* to build.

That "someone" is doing product management — talking to users, analyzing data, reading the codebase, synthesizing strategy docs, and making judgment calls about what to prioritize. Today this process is manual, fragmented, and disconnected from the coding agents that will do the building.

There is no system that supports the full loop of product discovery.

## The Insight

After a year of using AI as a Product Manager at Spotify, working daily with Claude in Cursor alongside 56 tool integrations and a custom knowledge base, we discovered something:

**The real unlock isn't AI writing docs. It's AI reconciling the four sources of product truth.**

Every product has four sources of truth that are constantly in tension:

| Source | Question | When They Disagree |
|--------|----------|--------------------|
| **Code** | What CAN happen? | Strategy claims features that don't exist |
| **Docs** | What's EXPECTED? | Roadmap doesn't match reality |
| **Data** | What IS happening? | Metrics contradict assumptions |
| **Judgment** | What SHOULD happen? | User needs differ from team beliefs |

PMs add value where these sources conflict. But finding those conflicts is manual, slow, and incomplete. Most PMs only see a subset of the evidence at any given time.

## The Product

Compass connects all four sources, finds where they disagree, and turns those disagreements into evidence-grounded product opportunities with agent-ready specifications.

### The Flow

```
compass connect (code, docs, data, interviews, support)
compass ingest          → 17 evidence items from 5 sources
compass reconcile       → 6 conflicts between sources
compass discover        → 5 ranked opportunities
compass specify         → agent-ready feature spec with task breakdown
```

### What Makes This Different

1. **Not a doc writer.** Most "AI for PMs" tools help you write docs faster. Compass helps you figure out what to write *about* — by surfacing what's true and where truths conflict.

2. **Evidence-grounded.** Every recommendation cites specific evidence: this interview quote, that usage metric, this code comment. No hallucinated priorities.

3. **Agent-ready output.** Specs include task breakdowns formatted for coding agents (Cursor, Claude Code). Compass is the bridge between "what to build" and "build it."

4. **Four-source reconciliation.** No other tool cross-references code, strategy, data, and user feedback to find contradictions. This is where the most important product insights hide.

## Why Now

Three things have converged:

1. **Coding agents are production-ready.** Cursor and Claude Code can execute well-defined specs. The bottleneck has shifted from implementation to specification.

2. **LLMs can reason across sources.** For the first time, AI can read a codebase, understand a strategy doc, analyze usage data, and synthesize interview themes — and find where they disagree.

3. **The PM workflow is ripe for disruption.** PM tooling hasn't fundamentally changed in a decade. It's still Jira + Google Docs + Figma + spreadsheets. PMs are assembling insights by hand from 10 different tabs.

## Traction / Validation

- Built and used daily as a PM at Spotify (one of the world's largest product organizations)
- Open-source PM AI Partner Framework documenting the methodology
- The framework has been battle-tested across real product decisions, codebase explorations, and stakeholder communications
- Compass CLI MVP is functional: init, connect, ingest, reconcile, discover, specify

## The Team

[Your background here — PM at Spotify, built internal PM AI tooling, deep experience with the problem]

## Market

- **Primary:** Product Managers at tech companies (estimated 500k+ globally)
- **Adjacent:** Founders and engineers doing PM work (especially at AI-native startups with small teams)
- **Expansion:** Any team making product decisions — design leads, engineering managers, CTOs

The market is larger than "PMs" because every team makes product decisions. As coding agents make engineering more accessible, the PM function becomes the bottleneck for more teams, not fewer.

## Business Model

**Open core.**

- **Open source:** The four-sources reconciliation model, connector interfaces, workflow definitions. Builds community and credibility.
- **Hosted product:** Managed knowledge graph, team collaboration, premium integrations (Amplitude, Mixpanel, Salesforce, Intercom), enterprise features. Subscription pricing.

## The Ask

We're building the tool we've been using daily as a PM. The methodology is proven. The MVP is functional. We need YC to help us go from "my PM workflow" to "every PM's workflow."

## Demo

```bash
# Install and run the demo in under 5 minutes
git clone https://github.com/your-org/compass-AI.git
cd compass-AI && pip install -e .
export ANTHROPIC_API_KEY=sk-ant-...
cd demo && bash run_demo.sh
```

The demo runs Compass against a fictional product with realistic evidence across all four sources. It surfaces real conflicts, generates real opportunities, and produces real specs — all in about 60 seconds.
