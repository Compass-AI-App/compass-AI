# Compass Project Rules

## Git Workflow

- **NEVER commit directly to main.** Always create a feature branch and open a PR.
- Branch naming: `feat/<task-id-lowercase>` (e.g., `feat/m0-t1-kg-persistence`)
- Commit format: `feat(<task-id>): <short description>`
- One task per PR. Never combine multiple tasks.
- If `gh` auth is broken, fix it before proceeding — do NOT fall back to local merges.

## Project Structure

- `engine/` — Python backend (FastAPI, ChromaDB, Anthropic SDK)
- `app/` — Electron frontend (React 19, Vite, TypeScript, Tailwind)
- `cloud/` — Cloud API (FastAPI, JWT auth, Stripe billing)
- `docs/` — Roadmap, implementation plan, ADRs

## Testing

- Engine tests: `cd engine && .venv/bin/python -m pytest tests/ -v`
- App typecheck: `cd app && npx tsc --noEmit`
- Engine import check: `cd engine && .venv/bin/python -c "from compass.server import app; print('OK')"`
- Mock LLM calls in tests. Never require a real API key.

## LLM Provider

- Default: `COMPASS_LLM_PROVIDER=taskforce` with Spotify's Hendrix gateway
- Config in `engine/.env` (gitignored)
- Supported providers: `anthropic`, `taskforce`, `cloud`
