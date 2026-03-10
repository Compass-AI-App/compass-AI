# Compass Quickstart

Welcome to the Compass beta! This guide gets you from zero to your first product discovery in under 10 minutes.

## Install

**Option A: macOS App**

1. Download the latest `.dmg` from [GitHub Releases](https://github.com/Compass-AI-App/compass-AI/releases)
2. Drag Compass to Applications
3. Launch — the onboarding wizard will guide you through setup

**Option B: CLI (pip)**

```bash
pip install compass-ai
compass --version
```

## Setup

### 1. Get an API Key

Compass uses Claude to analyze your evidence. You need an Anthropic API key:

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an API key
3. Set it in the app's Settings page, or as an environment variable:
   ```bash
   export ANTHROPIC_API_KEY="sk-ant-..."
   ```

### 2. Create a Workspace

**App:** The onboarding wizard handles this automatically.

**CLI:**
```bash
mkdir my-product && cd my-product
compass init "My Product" --description "What my product does"
```

### 3. Connect Sources

Compass analyzes four types of evidence:

| Type | Examples | CLI connector |
|------|----------|---------------|
| **Code** | Your repository | `github` |
| **Docs** | Strategy docs, PRDs, roadmaps | `docs` |
| **Data** | Analytics CSVs, metrics | `analytics` |
| **Judgment** | User interviews, support tickets | `interviews`, `support` |

**CLI:**
```bash
compass connect github --path /path/to/your/repo
compass connect docs --path /path/to/strategy-docs/
compass connect analytics --path /path/to/metrics.csv
compass connect interviews --path /path/to/interview-notes/
```

### 4. Run the Pipeline

```bash
compass ingest        # Reads all sources into the knowledge graph
compass reconcile     # Finds conflicts between sources
compass discover      # Synthesizes ranked product opportunities
compass specify "..."  # Generates agent-ready spec for an opportunity
```

Or use the app — click through Workspace → Evidence → Conflicts → Discover.

## Try the Demo First

Not ready to use your own data? Run the built-in demo:

```bash
compass demo
```

This runs the full pipeline on sample data showing a realistic product with strategic misalignment.

## MCP Integration (Power Users)

Use Compass inside Claude Code or Cursor:

```bash
compass mcp install
```

Then restart your AI tool. You can now ask "what should we build next?" and Compass tools will be available.

## Troubleshooting

Run the diagnostic tool:

```bash
compass doctor
```

This checks your setup and suggests fixes for any issues.

## Feedback

We want to hear from you! Use the feedback button in the app (bottom-right corner), or reach out directly.
