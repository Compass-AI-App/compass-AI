# Compass

**Cursor for Product Managers.**

AI-native product discovery that helps you figure out *what* to build, not just *how* to build it.

---

## The Problem

Cursor and Claude Code help teams build software once it's clear what needs to be built. But the hardest part of building a product people want is figuring out **what to build in the first place**.

Compass is the missing tool for that process.

## How It Works

Connect your product's evidence sources. Ask "what should we build next?" Get evidence-grounded recommendations with agent-ready specs.

### The Four Sources of Truth

| Source | Question | Examples |
|--------|----------|----------|
| **Code** | What CAN happen? | Codebase, APIs, architecture |
| **Docs** | What's EXPECTED? | Strategy, roadmaps, PRDs |
| **Data** | What IS happening? | Usage metrics, analytics, experiments |
| **Judgment** | What SHOULD happen? | User interviews, support tickets, feedback |

When these sources agree, things are working. When they disagree, that's where product opportunities hide.

### What You Get

1. **Conflict Report** — Where your sources of truth disagree, ranked by severity
2. **Opportunity Ranking** — Evidence-grounded recommendations for what to build
3. **Agent-Ready Specs** — Feature specs formatted for Cursor / Claude Code with task breakdowns

## Project Structure

```
compass-AI/
├── app/                  # Electron + React Mac app
│   ├── electron/         # Main process, preload, engine bridge
│   └── src/              # React UI (Vite + TypeScript + Tailwind)
├── engine/               # Python product discovery engine
│   ├── compass/
│   │   ├── models/       # Four sources data models
│   │   ├── engine/       # KnowledgeGraph, Orchestrator, Reconciler, Discoverer, Specifier
│   │   ├── connectors/   # GitHub, docs, analytics, interviews, support
│   │   ├── server.py     # FastAPI server
│   │   └── cli.py        # CLI interface
│   └── pyproject.toml
├── demo/                 # SyncFlow sample data + demo script
├── cloud/                # Compass Cloud API (future)
└── docs/                 # ADRs, specs, positioning
```

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 20+
- An Anthropic API key

### Setup

```bash
git clone https://github.com/your-org/compass-AI.git
cd compass-AI
make setup
```

### Set API Key

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

### Run the App

```bash
make dev
```

This starts the Electron app, which auto-launches the Python engine server.

### Run the CLI Demo

```bash
make demo
```

Runs Compass against a fictional product (SyncFlow) with realistic evidence. See [demo/README.md](demo/README.md) for details.

### Run Just the Engine

```bash
make engine
```

Starts the FastAPI server on port 9811. API docs at http://localhost:9811/docs.

## CLI Usage

```bash
compass init "My Product"
compass connect github --path ./my-repo
compass connect docs --path ./strategy/
compass connect analytics --path ./metrics.csv
compass connect interviews --path ./user-research/
compass connect support --path ./tickets.csv

compass ingest        # Index all evidence
compass reconcile     # Find where sources disagree
compass discover      # "What should we build next?"
compass specify       # Generate agent-ready feature specs
```

## Philosophy

PM work is reconciling four sources of truth. AI helps you explore each faster. Judgment stays human.

Compass is not "AI writes your PRDs." It's "AI helps you find what's true about your product, where the truths conflict, and what to do about it."

## License

MIT
