# Compass MCP Server Setup

Use Compass tools directly inside Claude Code, Cursor, or any MCP-compatible AI assistant.

## Quick Install

```bash
# Install Compass
cd engine && pip install -e .

# Auto-install MCP config
compass mcp install

# Restart your AI tool
```

## Manual Setup

### Claude Code

Add to `~/.claude/claude_code_config.json`:

```json
{
  "mcpServers": {
    "compass": {
      "command": "compass",
      "args": ["mcp", "serve"]
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "compass": {
      "command": "compass",
      "args": ["mcp", "serve"]
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `compass_status` | Workspace health: sources, evidence counts, freshness |
| `compass_ingest` | Ingest evidence from all connected sources |
| `compass_reconcile` | Find conflicts between sources of truth |
| `compass_discover` | Synthesize ranked product opportunities |
| `compass_specify` | Generate agent-ready spec for an opportunity |
| `compass_ask` | Ask a question grounded in evidence |
| `compass_search` | Semantic search across all evidence |
| `compass_refresh` | Re-ingest one or all sources |
| `compass_connect` | Connect a new evidence source |

## Usage Example

In Claude Code or Cursor chat:

1. "What's the current state of our product evidence?" → calls `compass_status`
2. "What should we build next?" → calls `compass_discover`
3. "Write the spec for the #1 opportunity" → calls `compass_specify`
4. "Implement task 1 from the spec" → AI writes code based on the spec

The full loop — evidence → discovery → specification → implementation — happens in one conversation.

## Environment Variables

- `COMPASS_WORKSPACE` — Override workspace path (default: walks up from cwd looking for `.compass/`)
- `ANTHROPIC_API_KEY` — Required for LLM calls

## Troubleshooting

- **"No Compass workspace found"** — Run `compass init "My Product"` in your project directory
- **"No evidence ingested"** — Run `compass ingest` or use the `compass_ingest` tool
- **Tools not appearing** — Restart your AI tool after adding the MCP config
