# Compass MCP Server Setup

Use Compass tools directly inside Claude Code, Cursor, or any MCP-compatible AI assistant.

## Prerequisites

- Python 3.11+ installed
- Compass installed: `cd engine && pip install -e .`
- A Compass workspace initialized: `compass init "My Product" && compass connect docs --path ./docs`
- `ANTHROPIC_API_KEY` set in your environment (needed for LLM-dependent tools)

## Setup

### Option 1: Auto-install (recommended)

```bash
# Navigate to your Compass workspace (has .compass/ directory)
cd /path/to/your/product

# Auto-install into Claude Code and/or Cursor
compass mcp install

# Restart Claude Code / Cursor
```

This writes the MCP config and sets `COMPASS_WORKSPACE` to your current directory.

### Option 2: Manual — Claude Code

Add to `~/.claude/claude_code_config.json`:

```json
{
  "mcpServers": {
    "compass": {
      "command": "compass",
      "args": ["mcp", "serve"],
      "env": {
        "COMPASS_WORKSPACE": "/absolute/path/to/your/product"
      }
    }
  }
}
```

Replace the path with the directory containing your `.compass/` folder.

### Option 3: Manual — Cursor

Add to `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "compass": {
      "command": "compass",
      "args": ["mcp", "serve"],
      "env": {
        "COMPASS_WORKSPACE": "/absolute/path/to/your/product"
      }
    }
  }
}
```

## Verify It Works

After restarting your AI tool, ask:

> "What's the status of my product evidence?"

This should call `compass_status` and return your workspace info.

If you see "No Compass workspace found", check that `COMPASS_WORKSPACE` points to the right directory.

## Available Tools

| Tool | Description | Needs API Key |
|------|-------------|:---:|
| `compass_status` | Workspace health: sources, evidence counts, freshness | No |
| `compass_connect` | Connect a new evidence source | No |
| `compass_ingest` | Ingest evidence from all connected sources | No |
| `compass_search` | Semantic search across all evidence | No |
| `compass_refresh` | Re-ingest one or all sources | No |
| `compass_reconcile` | Find conflicts between sources of truth | Yes |
| `compass_discover` | Synthesize ranked product opportunities | Yes |
| `compass_specify` | Generate agent-ready spec for an opportunity | Yes |
| `compass_ask` | Ask a question grounded in evidence | Yes |

## Usage Flow

In Claude Code or Cursor chat:

```
You: "What's the status of my product evidence?"
→ calls compass_status

You: "Ingest the latest evidence"
→ calls compass_ingest

You: "What should we build next?"
→ calls compass_discover

You: "Write a spec for the #1 opportunity"
→ calls compass_specify

You: "Implement task 1 from the spec"
→ AI writes code based on the spec
```

The full loop — evidence → discovery → specification → implementation — happens in one conversation.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `COMPASS_WORKSPACE` | Absolute path to workspace | Walks up from cwd looking for `.compass/` |
| `ANTHROPIC_API_KEY` | Required for LLM tools (reconcile, discover, specify, ask) | — |

## Troubleshooting

**"No Compass workspace found"**
- Set `COMPASS_WORKSPACE` in your MCP config env to the directory containing `.compass/`
- Or run `compass init "My Product"` in that directory first

**"No evidence ingested"**
- Run `compass connect` + `compass ingest`, or use the `compass_ingest` tool

**Tools not appearing in Claude Code**
- Check `~/.claude/claude_code_config.json` has the compass entry under `mcpServers`
- Restart Claude Code after adding/changing MCP config
- Run `compass mcp` to see the expected config JSON

**"ANTHROPIC_API_KEY not set"**
- Add `ANTHROPIC_API_KEY` to the `env` section of your MCP config, or set it in your shell profile
