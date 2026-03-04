# SyncFlow

The fastest way for teams to keep their work in sync across tools.

## Architecture

- **Sync Engine** — Core polling-based sync (sync_engine.py)
- **Connectors** — Slack, Jira, GitHub integrations
- **API** — Internal only (public API planned for Q2)
- **Auth** — Email/password (SSO planned for Q1)

## Setup

```bash
pip install -r requirements.txt
python -m syncflow serve
```

## Status

- v2.3.1 (current)
- Active connections: ~41,000
- Team: 4 engineers, 1 PM, 1 designer
