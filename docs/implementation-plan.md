# Compass: Implementation Plan

> Technical specification + distributable agent task cards for building Compass from current state (v0.1.0) through public launch and growth.
>
> **How to use this document:** Each task card in Part 2 is a self-contained work package designed to be handed to an AI coding agent (Cursor, Claude Code) as a prompt. Tasks within the same milestone can run in parallel unless the dependency graph (Part 3) says otherwise.

---

## Part 1: Technical Specification

### 1.1 Current State (v0.1.0)

The codebase is a monorepo with two main modules:

| Module | Stack | Status |
|--------|-------|--------|
| `engine/` | Python 3.11+, FastAPI, ChromaDB, Anthropic SDK, Typer CLI | Working CLI + HTTP server. 14 endpoints. 5 connectors. No tests. |
| `app/` | Electron 33, React 19, Vite 6, TypeScript, Tailwind, Zustand | Built but never run end-to-end. 6 pages, 7 stores. Streaming hook exists but unused. |
| `demo/` | Shell script + sample data | Working demo for SyncFlow fictional product. |
| `cloud/` | Does not exist yet | — |

### 1.2 Architecture

```
┌─────────────────────────────────────────────────────┐
│  Electron App (Mac/Win/Linux)                       │
│  ┌───────────────┐  ┌────────────────────────────┐  │
│  │ Main Process   │  │ Renderer (React + Vite)    │  │
│  │ engine-bridge  │──│ Pages / Components / Stores│  │
│  │ IPC handlers   │  │ Tailwind + shadcn/ui       │  │
│  └──────┬────────┘  └────────────────────────────┘  │
│         │ HTTP localhost                             │
└─────────┼───────────────────────────────────────────┘
          ▼
┌─────────────────────────────────────────────────────┐
│  Python Engine (Sidecar)                            │
│  ┌──────────┐ ┌──────────┐ ┌────────────────────┐  │
│  │ FastAPI   │ │ LLM Orch │ │ Knowledge Graph    │  │
│  │ 14 routes │ │ Provider │ │ ChromaDB + Store   │  │
│  └──────────┘ │ Agnostic │ └────────────────────┘  │
│               └─────┬────┘                          │
│  ┌──────────┐       │       ┌────────────────────┐  │
│  │Connectors│       │       │ Pipeline            │  │
│  │ 5 types  │       │       │ Reconcile/Discover  │  │
│  └──────────┘       │       │ Specify             │  │
│                     ▼       └────────────────────┘  │
│            ┌────────────────┐                        │
│            │ LLM Providers  │                        │
│            │ Anthropic(BYOK)│                        │
│            │ CompassCloud   │                        │
│            └────────────────┘                        │
└─────────────────────────────────────────────────────┘
          ▼ (future — M3+)
┌─────────────────────────────────────────────────────┐
│  Compass Cloud API                                  │
│  Auth (JWT) │ LLM Proxy │ Billing │ Team Sync      │
└─────────────────────────────────────────────────────┘
```

### 1.3 Data Models (Python — `engine/compass/models/`)

**SourceType** (enum): `code`, `docs`, `data`, `judgment`

**Evidence** (Pydantic):
```python
{id, source_type, connector, title, content, metadata, timestamp}
```

**EvidenceStore**: In-memory list of Evidence. Methods: `add`, `add_many`, `by_source`, `by_connector`, `summary`.

**Conflict** (Pydantic):
```python
{conflict_type, severity, title, description, source_a_evidence, source_b_evidence, recommendation}
```

**Opportunity** (Pydantic):
```python
{rank, title, description, confidence, evidence_summary, evidence_ids, conflict_ids, estimated_impact}
```

**FeatureSpec** (Pydantic):
```python
{title, opportunity, problem_statement, proposed_solution, ui_changes, data_model_changes, tasks[], success_metrics[], evidence_citations[]}
```

**AgentTask** (Pydantic):
```python
{number, title, context, acceptance_criteria[], files_to_modify[], tests}
```

### 1.4 Engine API Contracts (`engine/compass/server.py`)

All endpoints accept/return JSON. Base URL: `http://localhost:{port}`.

| Method | Endpoint | Request Body | Response | Notes |
|--------|----------|-------------|----------|-------|
| GET | `/health` | — | `{status, version}` | Used by engine-bridge for readiness polling |
| GET | `/usage` | — | `{session_tokens, total_tokens, total_cost_estimate}` | In-memory, resets on restart |
| POST | `/init` | `{name, description, workspace_path}` | `{status, workspace, name}` | Creates `.compass/compass.yaml` |
| POST | `/connect` | `{workspace_path, source_type, name, path?, url?}` | `{status, name, type, accessible}` | Validates connector access |
| POST | `/ingest` | `{workspace_path}` | `{status, total, sources[], summary}` | Clears KG, re-ingests all sources |
| POST | `/evidence` | `{workspace_path}` | `{status, count, summary, items[]}` | Returns all evidence |
| POST | `/reconcile` | `{workspace_path}` | `{status, count, conflicts[]}` | Also writes `conflict-report.md` |
| POST | `/discover` | `{workspace_path}` | `{status, count, opportunities[]}` | Also caches to `opportunities_cache.json` |
| POST | `/specify` | `{workspace_path, opportunity_title}` | `{status, title, markdown, spec, file}` | Writes spec to `.compass/output/` |
| POST | `/chat` | `{workspace_path, message, history[]}` | `{status, response, citations[]}` | Non-streaming |
| POST | `/chat/stream` | `{workspace_path, message, history[]}` | SSE: `{token}` / `{done}` | Streaming variant |
| POST | `/search` | `{workspace_path, query, source_type?, limit?}` | `{status, count, items[]}` | Semantic search |
| POST | `/reconcile/stream` | `{workspace_path}` | SSE: progress + result events | Streaming reconcile |
| POST | `/discover/stream` | `{workspace_path}` | SSE: progress + result events | Streaming discover |

### 1.5 App Architecture (`app/`)

**Electron main process** (`electron/main.ts`):
- Creates BrowserWindow with native Mac title bar
- Starts engine via `engine-bridge.ts` (spawn Python, poll `/health`)
- IPC handlers: `select-directory`, `select-file`, `save-file`, `engine-call`, `engine-stream`, `engine-health`

**Preload** (`electron/preload.ts`):
- Exposes `window.compass.engine.{call, health, stream, onStreamData}`
- Exposes `window.compass.app.{selectDirectory, selectFile, saveFile}`

**Zustand Stores** (`src/stores/`):
| Store | Key State | Status |
|-------|-----------|--------|
| `workspace.ts` | `workspacePath`, `sources`, `engineStatus`, `isIngesting` | Working but no persistence reload |
| `workspaceManager.ts` | `workspaces[]` in localStorage | Working |
| `evidence.ts` | `items[]`, `fetchEvidence()` | Working |
| `conflicts.ts` | `items[]`, `runReconcile()` | Working |
| `opportunities.ts` | `items[]`, `runDiscover()`, `generateSpec()` | Working |
| `chat.ts` | `messages[]`, `sendMessage()` | Working but non-streaming, no persistence |
| `settings.ts` | `provider`, `apiKey`, `model` | UI only — not wired to engine |

**Pages** (`src/pages/`):
| Page | Route | Description |
|------|-------|-------------|
| `WorkspacePage` | `/workspace` | Create/open workspace, connect sources, ingest |
| `EvidencePage` | `/evidence` | Browse evidence with source-type filters |
| `ConflictsPage` | `/conflicts` | Run reconcile, view conflict cards |
| `DiscoverPage` | `/discover` | Run discover, view opportunities, generate specs |
| `ChatPage` | `/chat` | Conversational interface |
| `SettingsPage` | `/settings` | Token usage, provider selection, model picker |

### 1.6 Known Bugs and Gaps

| # | Bug/Gap | Location | Impact |
|---|---------|----------|--------|
| 1 | **EvidenceStore is in-memory only** — lost on restart | `knowledge_graph.py` | Data loss — unusable for real work |
| 2 | **Settings not wired** — BYOK key, model never reach engine | `settings.ts` → engine | Settings page is cosmetic |
| 3 | **Chat uses non-streaming** — `useStreamingChat` hook exists but unused | `ChatPage.tsx`, `chat.ts` | Poor chat UX |
| 4 | **Workspace reload missing** — opening existing workspace doesn't load sources/evidence from KG | `_get_kg()` in `server.py` | Workspace forgets state |
| 5 | **CompassCloud provider** — raises `NotImplementedError` | `orchestrator.py` | No managed hosting path |
| 6 | **Global KG singleton** — one KG for all workspaces, no cleanup on switch | `server.py` `_kg` global | Data bleed between workspaces |
| 7 | **Chat stream SSE format** — server sends `{token}`, hook expects `data.token` | `server.py`, `useStreamingChat.ts` | Stream parsing broken |
| 8 | **SourceConnector file picker** — `selectFile()` called without type filters for analytics | `SourceConnector.tsx` | UX issue |
| 9 | **Discoverer `related_conflicts`** — LLM response field not mapped to `conflict_ids` | `discoverer.py` | Missing conflict links |
| 10 | **No error boundaries** — engine failures surface as white screens or silent failures | App-wide | Crash-prone UX |
| 11 | **Zero tests** — no unit, integration, or E2E tests | Everywhere | Can't refactor safely |
| 12 | **No CI/CD** — no automated checks | Repo-wide | Regressions slip through |

### 1.7 Architecture Decisions

| ID | Decision | Chosen Approach | Rationale |
|----|----------|----------------|-----------|
| AD-1 | KG persistence | JSON file for EvidenceStore + ChromaDB PersistentClient for embeddings | Simple, no extra dependency. SQLite is overkill for evidence counts < 10k. Upgrade to SQLite later if needed. |
| AD-2 | Cloud backend | Python FastAPI (same stack as engine) | One language, shared models, faster development for a solo dev. |
| AD-3 | Auth provider | Custom JWT (jose + passlib) | Minimal dependency, full control. Consider Clerk/Supabase if team grows. |
| AD-4 | Distribution | GitHub Releases + electron-updater | Standard for Electron apps. Mac App Store considered for M4+. |
| AD-5 | Connector extensibility | Internal Python classes → Connector SDK published in M4 | Keep simple until pattern is proven. |
| AD-6 | Workspace KG isolation | Reset `_kg` global on workspace switch; workspace path as KG identifier | Prevents data bleed. Simple approach. |

### 1.8 File-by-File Breakdown

#### Engine — files to create

| File | Milestone | Description |
|------|-----------|-------------|
| `engine/tests/test_models.py` | M1 | Unit tests for all Pydantic models |
| `engine/tests/test_orchestrator.py` | M1 | Unit tests for Orchestrator + TokenUsage |
| `engine/tests/test_connectors.py` | M1 | Unit tests for all connectors |
| `engine/tests/test_knowledge_graph.py` | M1 | KG persistence + query tests |
| `engine/tests/test_server.py` | M1 | FastAPI endpoint integration tests |
| `engine/compass/connectors/jira_connector.py` | M1 | Jira issue ingestion |
| `engine/compass/connectors/google_docs_connector.py` | M1 | Google Docs export ingestion |
| `engine/compass/connectors/slack_connector.py` | M1 | Slack export ingestion |
| `engine/compass/connectors/linear_connector.py` | M4 | Linear issue ingestion |
| `engine/compass/connectors/notion_connector.py` | M4 | Notion page ingestion |
| `engine/compass/connectors/amplitude_connector.py` | M4 | Amplitude/analytics ingestion |
| `engine/compass/connectors/zendesk_connector.py` | M4 | Zendesk ticket ingestion |
| `engine/compass/connectors/sdk.py` | M4 | Connector SDK for third-party devs |
| `cloud/` (entire directory) | M3 | Cloud API service |
| `.github/workflows/ci.yml` | M1 | GitHub Actions CI |

#### Engine — files to modify

| File | Milestone | Changes |
|------|-----------|---------|
| `engine/compass/engine/knowledge_graph.py` | M0 | Add `_save_store()` / `_load_store()` for JSON persistence of EvidenceStore |
| `engine/compass/engine/orchestrator.py` | M0 | Add `configure_orchestrator()` for runtime API key / model / provider switching |
| `engine/compass/engine/__init__.py` | M0 | Export `configure_orchestrator` |
| `engine/compass/server.py` | M0 | Add `POST /configure` endpoint; fix `_get_kg()` to load persisted data; add workspace isolation |
| `engine/compass/server.py` | M1 | Add `POST /refresh`, `POST /health/workspace`, `POST /history` endpoints; add `agent_mode` to chat |
| `engine/compass/engine/reconciler.py` | M1 | Improve prompts with few-shot examples |
| `engine/compass/engine/discoverer.py` | M1 | Map `related_conflicts` to `conflict_ids` |
| `engine/compass/connectors/__init__.py` | M1, M4 | Register new connectors |
| `engine/compass/models/sources.py` | M1, M4 | Add new connector type mappings |
| `engine/pyproject.toml` | M1 | Add `httpx`, `pytest`, `mypy` deps |
| `engine/compass/cli.py` | M4 | Add `login`, `signup`, `whoami`, `logout`, `--workspace` flag |

#### App — files to create

| File | Milestone | Description |
|------|-----------|-------------|
| `app/src/components/ErrorBoundary.tsx` | M0 | React error boundary component |
| `app/src/pages/OnboardingPage.tsx` | M2 | First-run onboarding wizard |
| `app/src/components/FeedbackButton.tsx` | M2 | In-app feedback mechanism |
| `app/build/entitlements.mac.plist` | M2 | macOS code signing entitlements |

#### App — files to modify

| File | Milestone | Changes |
|------|-----------|---------|
| `app/src/stores/settings.ts` | M0 | Add `pushToEngine()` that calls `POST /configure`; persist `apiKey` |
| `app/src/App.tsx` | M0 | Wrap with `ErrorBoundary`; call `loadSettings()` + `pushToEngine()` on mount |
| `app/src/stores/chat.ts` | M1 | Add `loadChatHistory()` / `saveChatHistory()` for localStorage persistence; wire streaming |
| `app/src/pages/ChatPage.tsx` | M1, M2 | Wire streaming chat; add agent mode selector |
| `app/src/components/discover/SpecView.tsx` | M2 | Add "Copy for Cursor", "Copy for Claude Code", "Save .md" buttons |
| `app/src/components/layout/AppLayout.tsx` | M2 | Add FeedbackButton |
| `app/package.json` | M2 | Add `electron-updater`; add `build` config for electron-builder |
| `app/electron/main.ts` | M2 | Add auto-updater initialization |

---

## Part 2: Agent Task Cards

Each task card below is a self-contained work package. The `## Context` section gives the agent everything it needs. The `## Scope` section defines exactly what to do. The `## DoD` section defines how to verify completion.

**Naming convention:** `M{milestone}-T{task_number}` (e.g., M0-T1)

---

### M0: Working Demo (Weeks 1-2)

**Goal:** Electron app runs end-to-end — create workspace, connect sources, ingest, reconcile, discover, generate spec, chat — all from the UI without errors. Data survives restart.

---

#### M0-T1: Engine — Knowledge Graph Persistence

**Context:**
- `engine/compass/engine/knowledge_graph.py` has a `KnowledgeGraph` class with ChromaDB PersistentClient and an in-memory `EvidenceStore`.
- ChromaDB already persists embeddings to disk (via `PersistentClient`), but the `EvidenceStore` (the structured evidence list) is purely in-memory and lost on restart.
- `engine/compass/models/sources.py` defines `Evidence` (Pydantic BaseModel) and `EvidenceStore`.

**Scope:**
1. In `knowledge_graph.py`, add a `_save_store()` method that serializes `self._store.items` to `evidence_store.json` inside the `persist_dir`. Use Pydantic's `.model_dump()` with JSON serialization (handle `datetime`).
2. Add a `_load_store()` method called in `__init__` that loads `evidence_store.json` if it exists and populates `self._store.items`.
3. Call `_save_store()` at the end of `add()` and `add_many()`.
4. In `clear()`, delete `evidence_store.json` if it exists.
5. In `query()`, guard against `n_results=0` when store is empty (currently passes `min(n_results, len(self._store))` which is 0 — ChromaDB may error).

**Files to modify:**
- `engine/compass/engine/knowledge_graph.py`

**DoD:**
- Start engine, ingest demo data, stop engine, restart engine — evidence is still there.
- `evidence_store.json` exists in `.compass/knowledge/` after ingestion.
- `clear()` removes the file.

---

#### M0-T2: Engine — Settings Configuration Endpoint

**Context:**
- `engine/compass/engine/orchestrator.py` has a singleton `Orchestrator` with `get_orchestrator()` / `reset_orchestrator()`. The `AnthropicProvider` reads `ANTHROPIC_API_KEY` from env. There's no way to change provider/key/model at runtime.
- `engine/compass/server.py` has 14 endpoints but no `/configure` endpoint.
- The app's Settings page lets users pick provider (compass/byok), enter an API key, and select a model — but none of this reaches the engine.

**Scope:**
1. In `orchestrator.py`, add a `configure_orchestrator(api_key, model, provider)` function that:
   - Creates the appropriate `LLMProvider` based on `provider` param ("anthropic", "cloud", or default)
   - If `api_key` is provided and provider is "anthropic", creates `AnthropicProvider(api_key=api_key)`
   - Preserves existing `TokenUsage` from the old orchestrator instance
   - Sets the new `Orchestrator` as the global `_instance`
2. Export `configure_orchestrator` from `engine/compass/engine/__init__.py`.
3. In `server.py`, add a `POST /configure` endpoint accepting `{api_key, model, provider}` that calls `configure_orchestrator()`.

**Files to modify:**
- `engine/compass/engine/orchestrator.py`
- `engine/compass/engine/__init__.py`
- `engine/compass/server.py`

**DoD:**
- `POST /configure {"api_key": "sk-ant-...", "model": "claude-sonnet-4-20250514", "provider": "anthropic"}` returns `{"status": "ok"}`.
- Subsequent LLM calls use the new key/model.
- Token usage is preserved across reconfiguration.

---

#### M0-T3: App — Wire Settings to Engine + Error Boundaries

**Context:**
- `app/src/stores/settings.ts` stores `provider`, `apiKey`, `model` in Zustand state and persists `provider` + `model` to localStorage. But it never sends these to the engine.
- `app/src/App.tsx` renders a `BrowserRouter` with routes but has no error handling — if a component throws, the entire app white-screens.
- The engine now has `POST /configure` (from M0-T2).

**Scope:**
1. In `settings.ts`:
   - Add `pushToEngine()` async method that calls `window.compass.engine.call("/configure", {api_key, model, provider})`.
   - Call `pushToEngine()` inside `setProvider`, `setApiKey`, `setModel` (after `saveSettings()`).
   - In `saveSettings()`, also persist `apiKey` when provider is `byok`.
   - In `loadSettings()`, also load `apiKey`.
2. Create `app/src/components/ErrorBoundary.tsx`:
   - React class component with `componentDidCatch` and `getDerivedStateFromError`.
   - Renders a fallback UI with error message and "Try Again" button that calls `window.location.reload()`.
   - Styled with Tailwind to match the app's dark theme.
3. In `App.tsx`:
   - Wrap `BrowserRouter` with `ErrorBoundary`.
   - Add `useEffect` on mount to call `loadSettings()` and `pushToEngine()`.

**Files to create:**
- `app/src/components/ErrorBoundary.tsx`

**Files to modify:**
- `app/src/stores/settings.ts`
- `app/src/App.tsx`

**DoD:**
- Enter API key in Settings → engine receives it (verify via engine logs or `/configure` response).
- A component throwing an error shows the error boundary UI instead of a white screen.
- App startup loads saved settings and pushes them to engine.

**Depends on:** M0-T2 (engine `/configure` endpoint must exist)

---

#### M0-T4: Engine — Workspace Isolation and KG Reload

**Context:**
- `server.py` has a global `_kg` variable. `_get_kg()` checks if `_kg` exists and has items; if not, it re-ingests from connectors. This means: (a) switching workspaces bleeds data, (b) on restart, it re-ingests instead of loading persisted data.
- After M0-T1, the KG can persist/reload from `evidence_store.json`.

**Scope:**
1. In `server.py`, change `_get_kg()` to:
   - Track the current workspace path alongside `_kg` (e.g., `_kg_workspace_path` global).
   - If `workspace_path` differs from `_kg_workspace_path`, create a new KG for the new workspace.
   - When creating a KG, just instantiate `KnowledgeGraph(persist_dir=...)` — M0-T1's `_load_store()` in `__init__` will auto-load persisted data.
   - Remove the re-ingestion loop from `_get_kg()`.
2. Ensure the `/ingest` endpoint still works: it clears and re-ingests (this already works).
3. Test: switch between two workspaces via API calls, verify evidence doesn't bleed.

**Files to modify:**
- `engine/compass/server.py`

**DoD:**
- Open workspace A (ingest) → open workspace B (ingest) → open workspace A again → only workspace A's evidence is visible.
- Restart engine → open workspace A → evidence is still there (loaded from persistence, not re-ingested).

**Depends on:** M0-T1 (KG persistence must be implemented)

---

#### M0-T5: Integration Validation and Demo Polish

**Context:**
- After M0-T1 through M0-T4, the full flow should work. This task is about running it end-to-end and fixing any issues that emerge.
- Demo data lives in `demo/sample_data/` with code, strategy docs, analytics CSVs, interview transcripts, and support tickets.

**Scope:**
1. Run `make dev` and verify the full flow through the UI:
   - Create workspace pointing to `demo/sample_data/`
   - Connect all 5 source types (code → `demo/sample_data/code`, docs → `demo/sample_data/strategy`, analytics → `demo/sample_data/analytics/usage_metrics.csv`, interviews → `demo/sample_data/interviews`, support → `demo/sample_data/support/support_tickets.csv`)
   - Ingest — verify evidence count
   - View Evidence page — filter by source type
   - Run Reconcile — verify conflicts appear
   - Run Discover — verify opportunities appear
   - Generate Spec — verify spec renders
   - Chat — ask "what are users frustrated about?" and verify cited response
   - Cmd+K search — verify results
2. Close app, reopen — verify workspace and evidence persist.
3. Fix any bugs found during this walkthrough.
4. Ensure no console errors in Electron DevTools.

**Files to modify:** Any files where bugs are found.

**DoD:**
- Full flow works without errors in the UI.
- App restart preserves workspace and evidence.
- No unhandled exceptions in console.

**Depends on:** M0-T1, M0-T2, M0-T3, M0-T4 (all prior M0 tasks)

---

### M1: Dogfood-Ready (Weeks 3-5)

**Goal:** Stable enough for daily PM work. Real connectors, tests, CI/CD, improved quality.

---

#### M1-T1: Jira Connector

**Context:**
- Existing connectors live in `engine/compass/connectors/`. Each is a class inheriting from `Connector` (defined in `base.py`) with `validate()` and `ingest()` methods.
- `SourceConfig` has `{type, name, path, url, options}`. Connectors receive a `SourceConfig` in their constructor.
- `CONNECTOR_SOURCE_MAP` in `models/sources.py` maps connector type strings to `SourceType` enums.
- Jira issues should be classified as `JUDGMENT` source type.

**Scope:**
1. Create `engine/compass/connectors/jira_connector.py`:
   - `JiraConnector(Connector)` with `validate()` and `ingest()`.
   - Support two modes: (a) JSON export file (`config.path` points to a `.json` file exported from Jira), (b) Jira Cloud API (`config.url` is the Jira instance URL, `config.options` has `api_token` and `email`).
   - For JSON mode: parse the JSON array of issues, extract `key`, `summary`, `description`, `status`, `priority`, `comments`.
   - For API mode: use `httpx` to call `GET /rest/api/3/search` with JQL, paginate through results.
   - Each issue becomes one `Evidence` item with `source_type=JUDGMENT`, `connector="jira"`, `title="{key}: {summary}"`, `content` includes description + comments.
2. Register in `connectors/__init__.py`: map `"jira"` → `JiraConnector`.
3. Add `"jira": SourceType.JUDGMENT` to `CONNECTOR_SOURCE_MAP` in `models/sources.py`.

**Files to create:**
- `engine/compass/connectors/jira_connector.py`

**Files to modify:**
- `engine/compass/connectors/__init__.py`
- `engine/compass/models/sources.py`

**DoD:**
- `JiraConnector` with JSON path returns Evidence items from a test JSON file.
- Registered and accessible via `get_connector("jira")`.
- `validate()` returns True for valid JSON path, False for missing file.

---

#### M1-T2: Google Docs Connector

**Context:**
- Same connector pattern as M1-T1.
- Google Docs should be classified as `DOCS` source type.
- For MVP, ingest exported files (`.md`, `.txt`, `.docx`) from a local directory. Full Google Docs API integration is future work.

**Scope:**
1. Create `engine/compass/connectors/google_docs_connector.py`:
   - `GoogleDocsConnector(Connector)` with `validate()` and `ingest()`.
   - `config.path` points to a directory of exported docs.
   - Reads `.md`, `.txt` files directly; for `.docx`, use `python-docx` (add to pyproject.toml optional deps or handle import gracefully).
   - Each file becomes one `Evidence` item with `source_type=DOCS`, `connector="google_docs"`.
2. Register in `connectors/__init__.py`.
3. Add mapping in `models/sources.py` (note: `"google_docs": SourceType.DOCS` already exists).

**Files to create:**
- `engine/compass/connectors/google_docs_connector.py`

**Files to modify:**
- `engine/compass/connectors/__init__.py`

**DoD:**
- `GoogleDocsConnector` with a directory path returns Evidence items from `.md`/`.txt`/`.docx` files.
- Gracefully handles missing `python-docx` (skips `.docx` with warning, doesn't crash).

---

#### M1-T3: Slack Export Connector

**Context:**
- Same connector pattern.
- Slack data export format: directory per channel, each containing JSON files with message arrays.
- Slack messages should be classified as `JUDGMENT` source type.

**Scope:**
1. Create `engine/compass/connectors/slack_connector.py`:
   - `SlackConnector(Connector)` with `validate()` and `ingest()`.
   - `config.path` points to a Slack export directory.
   - Walks the directory, reads JSON files, parses messages.
   - Filters out system/bot messages (messages without `"user"` field or with `"subtype"`).
   - Groups messages into threads or by-day chunks (to avoid one Evidence per message — too granular).
   - Each chunk becomes one `Evidence` item with `source_type=JUDGMENT`, `connector="slack"`.
2. Register in `connectors/__init__.py`.
3. Add `"slack": SourceType.JUDGMENT` to `CONNECTOR_SOURCE_MAP`.

**Files to create:**
- `engine/compass/connectors/slack_connector.py`

**Files to modify:**
- `engine/compass/connectors/__init__.py`
- `engine/compass/models/sources.py`

**DoD:**
- `SlackConnector` with a Slack export directory returns Evidence items.
- Bot/system messages are filtered out.
- Messages are grouped into meaningful chunks (not one per message).

---

#### M1-T4: Prompt Engineering — Reconciliation and Discovery

**Context:**
- `engine/compass/engine/reconciler.py` has `RECONCILE_SYSTEM` and `RECONCILE_PROMPT` used for LLM calls. Current prompts produce inconsistent quality.
- `engine/compass/engine/discoverer.py` has `DISCOVER_SYSTEM` and `DISCOVER_PROMPT`. The `related_conflicts` field from LLM response is not mapped to `conflict_ids` in the `Opportunity` model.

**Scope:**
1. In `reconciler.py`:
   - Rewrite `RECONCILE_SYSTEM` to be more specific about what constitutes a real conflict (not just a difference).
   - Add 2-3 few-shot examples to `RECONCILE_PROMPT` showing good conflict identification.
   - Specify the exact JSON schema expected in the response.
   - Add guidance: "Only surface conflicts that a PM should act on. Ignore trivial differences."
2. In `discoverer.py`:
   - Rewrite `DISCOVER_SYSTEM` to emphasize evidence-grounding and actionability.
   - Add few-shot examples to `DISCOVER_PROMPT`.
   - Fix the `related_conflicts` → `conflict_ids` mapping: after parsing the LLM response, extract `related_conflicts` and assign to `Opportunity.conflict_ids`.
3. Read current prompts before modifying. Keep the same LLM calling pattern, just improve prompt content.

**Files to modify:**
- `engine/compass/engine/reconciler.py`
- `engine/compass/engine/discoverer.py`

**DoD:**
- Reconciliation against demo data produces fewer false-positive conflicts and more actionable descriptions.
- Each opportunity's `conflict_ids` field is populated when related conflicts exist.
- Prompt changes don't break the JSON parsing logic.

---

#### M1-T5: Chat Streaming + Persistence

**Context:**
- `app/src/hooks/useStreamingChat.ts` implements SSE-based streaming via `window.compass.engine.stream("/chat/stream", ...)` and `onStreamData`. It exists but is NOT used — `ChatPage.tsx` uses the non-streaming `sendMessage()` from `chat.ts` store.
- `server.py` `/chat/stream` sends SSE: first a `citations` event, then `data: {"token": "..."}` lines, then `data: {"done": true}`.
- `useStreamingChat.ts` expects `data.token` and `data.done` — this should match.
- Chat messages are not persisted across sessions.

**Scope:**
1. In `chat.ts` store:
   - Add `saveChatHistory(workspacePath)` that saves messages to `localStorage` keyed by workspace path (cap at 100 messages).
   - Add `loadChatHistory(workspacePath)` that loads from localStorage.
   - Call `saveChatHistory()` after each message send completes.
2. In `ChatPage.tsx`:
   - Replace the non-streaming `sendMessage()` with the `useStreamingChat` hook.
   - Call `loadChatHistory(workspacePath)` on mount.
   - Ensure citations render correctly from the stream.
3. Verify the SSE format between `server.py` `/chat/stream` and `useStreamingChat.ts` match. Fix any mismatches.

**Files to modify:**
- `app/src/stores/chat.ts`
- `app/src/pages/ChatPage.tsx`

**DoD:**
- Chat shows tokens streaming in real-time (not waiting for full response).
- Close and reopen app → chat history is preserved.
- Citations appear alongside the response.

---

#### M1-T6: Engine Test Suite

**Context:**
- Zero tests exist. The engine has models (`sources.py`, `conflicts.py`, `specs.py`), an orchestrator (`orchestrator.py`), connectors (5 existing + 3 new from M1-T1/T2/T3), a knowledge graph, and a FastAPI server.
- `pyproject.toml` already has `pytest` in dev dependencies.

**Scope:**
1. Create `engine/tests/__init__.py` (empty).
2. Create `engine/tests/test_models.py`:
   - Test `SourceType` enum properties.
   - Test `Evidence` creation, `short` property.
   - Test `EvidenceStore` add/add_many/by_source/by_connector/summary.
   - Test `Conflict`, `ConflictReport` creation and properties.
   - Test `Opportunity`, `AgentTask`, `FeatureSpec` creation and `to_markdown()`.
3. Create `engine/tests/test_orchestrator.py`:
   - Test `TokenUsage` record, total, estimated_cost_usd.
   - Test `Orchestrator` with a mock `LLMProvider` (don't call real API).
   - Test `ask()`, `ask_json()`, `ask_stream()` with mocked provider.
   - Test `configure_orchestrator()` preserves usage.
   - Test `get_orchestrator()` singleton behavior.
4. Create `engine/tests/test_connectors.py`:
   - Test `get_connector()` returns correct classes.
   - Test each connector's `validate()` and `ingest()` with fixture files:
     - `GitHubConnector`: create temp dir with a `README.md` and Python file.
     - `DocsConnector`: create temp dir with markdown files.
     - `AnalyticsConnector`: create temp CSV.
     - `InterviewConnector`: create temp interview markdown.
     - `SupportConnector`: create temp support CSV.
     - `JiraConnector`: create temp JSON file.
     - `GoogleDocsConnector`: create temp directory with `.md`/`.txt` files.
     - `SlackConnector`: create temp Slack export directory.
5. Create `engine/tests/test_knowledge_graph.py`:
   - Test `add()`, `add_many()`, `query()`, `clear()`, `__len__()`.
   - Test persistence: add items → create new KG with same `persist_dir` → verify items loaded.
   - Use `tmp_path` fixture for isolation.
6. Create `engine/tests/test_server.py`:
   - Use FastAPI `TestClient`.
   - Test `/health`, `/usage`, `/init`, `/connect`, `/ingest`, `/evidence`, `/search`, `/configure`.
   - Use `tmp_path` fixture for workspace paths.
   - Mock the orchestrator to avoid real LLM calls (set `ANTHROPIC_API_KEY` to dummy value and mock the provider's `complete()` method).

**Files to create:**
- `engine/tests/__init__.py`
- `engine/tests/test_models.py`
- `engine/tests/test_orchestrator.py`
- `engine/tests/test_connectors.py`
- `engine/tests/test_knowledge_graph.py`
- `engine/tests/test_server.py`

**Files to modify:**
- `engine/pyproject.toml` — ensure `pytest` is in dev deps, add `[tool.pytest.ini_options]` section

**DoD:**
- `cd engine && python -m pytest tests/ -v` — all tests pass.
- Coverage: every model class tested, every connector tested, every server endpoint tested.
- Tests don't require a real API key (mock LLM calls).
- Tests are isolated (use `tmp_path`, no global state leakage).

---

#### M1-T7: CI/CD Pipeline

**Context:**
- No GitHub Actions exist.
- Engine uses `ruff` for linting (in pyproject.toml), supports `mypy` for type checking.
- App uses TypeScript (`tsc --noEmit` for type checking) and Vite for building.

**Scope:**
1. Create `.github/workflows/ci.yml` with the following jobs:
   - `engine-lint`: Python 3.11, `pip install -e ".[dev]"`, `ruff check .`
   - `engine-typecheck`: `mypy compass/` (add `mypy` to dev deps if not present)
   - `engine-test`: `pytest tests/ -v`
   - `app-lint`: Node 20, `npm ci`, `npx tsc --noEmit`
   - `app-build`: `npm ci`, `npm run build` (Vite build)
2. All jobs run on `push` and `pull_request` to `main`.
3. Add `mypy` to `pyproject.toml` `[project.optional-dependencies].dev` if not present.
4. Ensure `ruff` config exists in `pyproject.toml`.

**Files to create:**
- `.github/workflows/ci.yml`

**Files to modify:**
- `engine/pyproject.toml` (if `mypy` not in dev deps)

**DoD:**
- Push to a branch → GitHub Actions runs all 5 jobs.
- All jobs pass on current codebase (may need minor fixes to satisfy linter/type-checker).

---

#### M1-T8: Chat Agent Modes

**Context:**
- `ChatPage.tsx` has a chat interface. Currently uses a single system prompt.
- `server.py` `/chat` endpoint uses a hardcoded `CHAT_SYSTEM` prompt.
- Want to offer different "personalities": Default, Thought Partner, Technical Analyst, Devil's Advocate.

**Scope:**
1. In `server.py`:
   - Define an `AGENT_MODES` dict mapping mode names to system prompts:
     - `"default"`: Current CHAT_SYSTEM prompt.
     - `"thought_partner"`: Collaborative, explores trade-offs, asks clarifying questions.
     - `"technical_analyst"`: Focuses on technical feasibility, architecture, implementation.
     - `"devil_advocate"`: Challenges assumptions, surfaces risks, pushes back.
   - Add `agent_mode: str = "default"` field to `ChatRequest`.
   - In `/chat` and `/chat/stream`, select system prompt from `AGENT_MODES` based on `req.agent_mode`.
2. In `ChatPage.tsx`:
   - Add a row of selectable pills/tabs below the header for each agent mode.
   - Track `agentMode` in component state.
   - Pass `agentMode` when sending messages.

**Files to modify:**
- `engine/compass/server.py`
- `app/src/pages/ChatPage.tsx`

**DoD:**
- Chat page shows 4 selectable agent mode pills.
- Selecting "Devil's Advocate" and asking a question returns a response that challenges the premise.
- Default mode works as before.

---

### M2: Private Beta (Weeks 6-10)

**Goal:** 10 PMs can install, use, and give feedback. .dmg distribution, onboarding, polish.

---

#### M2-T1: Electron App Distribution

**Context:**
- `app/package.json` has a `build:mac` script but no `build` configuration for electron-builder.
- Need to configure electron-builder for macOS `.dmg`, with code signing and auto-updater.
- `electron-updater` is the standard Electron auto-update library.

**Scope:**
1. In `package.json`:
   - Add `electron-updater` dependency.
   - Add `build` configuration object for electron-builder:
     - `appId`: `"dev.compass.app"`
     - `productName`: `"Compass"`
     - `directories.output`: `"release"`
     - `files`: include `dist/`, `dist-electron/`
     - `extraResources`: bundle `../engine/` (the Python sidecar)
     - `mac`: `.dmg` target, `category: "public.app-category.developer-tools"`, icon path, entitlements
     - `publish`: GitHub provider for auto-updates
   - Add `build:win` and `build:linux` scripts.
2. Create `app/build/entitlements.mac.plist` with required macOS entitlements (JIT, network client, file access).
3. In `electron/main.ts`:
   - Add `initAutoUpdater()` that imports `electron-updater` and calls `autoUpdater.checkForUpdatesAndNotify()` when the app is packaged.
   - Call it in the `app.whenReady()` handler.
4. Update `Makefile` with `build-mac`, `build-win` targets.

**Files to create:**
- `app/build/entitlements.mac.plist`

**Files to modify:**
- `app/package.json`
- `app/electron/main.ts`
- `Makefile`

**DoD:**
- `cd app && npm run build:mac` produces a `.dmg` in `release/` directory.
- Auto-updater code is present (won't work without code signing, but shouldn't crash).
- Entitlements file covers network, file access, JIT.

---

#### M2-T2: Onboarding Wizard

**Context:**
- Currently, opening the app for the first time shows the empty workspace page. No guidance.
- Need a first-run wizard that walks the user through: welcome → create product → configure settings → connect first source.
- `useWorkspaceStore` manages workspace state. `useSettingsStore` manages settings. `useWorkspaceManager` (in `workspaceManager.ts`) manages the workspace list.

**Scope:**
1. Create `app/src/pages/OnboardingPage.tsx`:
   - Multi-step wizard (4 steps): Welcome, Create Product, Settings, Connect Sources.
   - Step 1 (Welcome): Hero text explaining Compass, "Get Started" button.
   - Step 2 (Create Product): Name + description inputs, "Choose Folder" button for workspace path.
   - Step 3 (Settings): Provider selection (Compass Cloud / BYOK), API key input if BYOK, model selector.
   - Step 4 (Connect Sources): Show 5 source type cards, let user connect at least 1.
   - On completion: call workspace init API, save settings, set `localStorage.setItem("compass-onboarded", "true")`, navigate to workspace page.
2. In `App.tsx`:
   - Check `localStorage.getItem("compass-onboarded")` on mount.
   - If not onboarded, render `OnboardingPage` instead of the normal router.

**Files to create:**
- `app/src/pages/OnboardingPage.tsx`

**Files to modify:**
- `app/src/App.tsx`

**DoD:**
- First launch shows the onboarding wizard.
- Completing it creates a workspace and navigates to the main app.
- Subsequent launches skip onboarding.
- "Reset onboarding" possible by clearing localStorage.

---

#### M2-T3: Spec Export Enhancement

**Context:**
- `app/src/components/discover/SpecView.tsx` renders a generated spec in a slide-over panel. Currently has basic "Copy Full" functionality.
- Specs contain `tasks[]` which are agent-ready task breakdowns.

**Scope:**
1. In `SpecView.tsx`, add export buttons:
   - "Copy for Cursor": formats the spec optimized for Cursor Agent mode (task-focused, file paths emphasized).
   - "Copy for Claude Code": formats for Claude Code (full context, step-by-step).
   - "Copy Full Markdown": copies entire spec markdown.
   - "Save .md": uses `window.compass.app.saveFile()` to save to disk.
2. Create formatter functions:
   - `formatForCursor(spec)`: Extracts tasks, emphasizes file paths and acceptance criteria.
   - `formatForClaudeCode(spec)`: Full problem statement + solution + tasks with more context.
3. Style the export buttons as a button group at the top of the spec view.

**Files to modify:**
- `app/src/components/discover/SpecView.tsx`

**DoD:**
- Spec view shows 4 export buttons.
- "Copy for Cursor" copies a task-focused format to clipboard.
- "Copy for Claude Code" copies a context-rich format.
- "Save .md" opens a save dialog and writes the file.

---

#### M2-T4: In-App Feedback + Error Reporting

**Context:**
- No way for beta users to send feedback or report bugs.
- Need a lightweight mechanism — no backend needed for MVP, just collect and store locally (or email).

**Scope:**
1. Create `app/src/components/FeedbackButton.tsx`:
   - Floating button (bottom-right corner) with a message icon.
   - Clicking opens a modal/dialog with:
     - Type selector: Bug / Feature Request / General Feedback
     - Text area for the feedback message
     - Submit button
   - On submit: save to `localStorage` as an array of feedback entries (with timestamp, type, message, app version).
   - Show a "Thank you" toast/notification.
2. In `AppLayout.tsx`, add `<FeedbackButton />` so it's present on all pages.

**Files to create:**
- `app/src/components/FeedbackButton.tsx`

**Files to modify:**
- `app/src/components/layout/AppLayout.tsx`

**DoD:**
- Floating feedback button visible on all pages.
- Clicking opens a form, submitting stores to localStorage.
- Feedback entries are retrievable via DevTools → localStorage.

---

### M3: Compass Cloud + Pricing (Months 3-4)

**Goal:** Users can sign up, use Compass without their own API key, and upgrade to Pro.

---

#### M3-T1: Cloud API — Auth and User Management

**Context:**
- No `cloud/` directory exists yet.
- Need a Python FastAPI server (same stack as engine for consistency).
- JWT-based auth: signup, login, token refresh.

**Scope:**
1. Create `cloud/` directory with:
   - `cloud/pyproject.toml`: deps (`fastapi`, `uvicorn`, `python-jose[cryptography]`, `passlib[bcrypt]`, `pydantic-settings`, `python-dotenv`, `sqlalchemy`, `asyncpg`, `httpx`, `anthropic`).
   - `cloud/compass_cloud/__init__.py`
   - `cloud/compass_cloud/config.py`: `Settings` class using `pydantic_settings` for `DATABASE_URL`, `JWT_SECRET`, `JWT_ALGORITHM`, `ANTHROPIC_API_KEY`, plan limits.
   - `cloud/compass_cloud/models.py`: SQLAlchemy models for `User` (id, email, password_hash, plan, stripe_customer_id, created_at) and `UsageRecord` (id, user_id, tokens_in, tokens_out, model, created_at).
   - `cloud/compass_cloud/auth.py`: password hashing (bcrypt), JWT creation/verification, `get_current_user` dependency.
   - `cloud/compass_cloud/server.py`: FastAPI app with:
     - `POST /auth/signup` — create user, return JWT
     - `POST /auth/login` — verify credentials, return JWT
     - `GET /auth/me` — return current user info (requires auth)
     - `GET /health` — health check
2. For initial development, use an in-memory dict store for users (defer Postgres setup to deployment).

**Files to create:**
- `cloud/pyproject.toml`
- `cloud/compass_cloud/__init__.py`
- `cloud/compass_cloud/config.py`
- `cloud/compass_cloud/models.py`
- `cloud/compass_cloud/auth.py`
- `cloud/compass_cloud/server.py`

**Files to modify:**
- `Makefile` — add `setup-cloud` and `cloud` targets
- `.gitignore` — add `cloud/.venv/`, `cloud/*.egg-info/`

**DoD:**
- `POST /auth/signup {"email": "test@test.com", "password": "secret"}` returns `{token, user}`.
- `POST /auth/login` with same credentials returns a valid JWT.
- `GET /auth/me` with `Authorization: Bearer <token>` returns user info.
- Invalid token returns 401.

---

#### M3-T2: Cloud API — LLM Proxy with Metering

**Context:**
- The cloud API (M3-T1) has auth. Now need a proxy endpoint that forwards LLM requests to Anthropic while tracking token usage per user.
- Engine's `CompassCloudProvider` in `orchestrator.py` should call this proxy instead of calling Anthropic directly.

**Scope:**
1. In `cloud/compass_cloud/`, create `proxy.py`:
   - `proxy_completion(prompt, system, model, max_tokens, user_id)` function.
   - Calls Anthropic API using the cloud's own `ANTHROPIC_API_KEY`.
   - Returns `(response_text, input_tokens, output_tokens)`.
2. In `cloud/compass_cloud/server.py`, add:
   - `POST /proxy/complete` — requires auth, accepts `{prompt, system, model, max_tokens}`, calls `proxy_completion()`, records usage, returns `{text, input_tokens, output_tokens}`.
   - Token usage recording: store per-user running total (in-memory for now, DB later).
   - Plan limit enforcement: check user's monthly token usage against plan limits before proxying. Return 429 if exceeded.
3. In `engine/compass/engine/orchestrator.py`:
   - Implement `CompassCloudProvider.complete()`: POST to `{cloud_url}/proxy/complete` with auth token, return `(text, input_tokens, output_tokens)`.
   - Add `httpx` to engine dependencies.

**Files to create:**
- `cloud/compass_cloud/proxy.py`

**Files to modify:**
- `cloud/compass_cloud/server.py`
- `engine/compass/engine/orchestrator.py`
- `engine/pyproject.toml` (add `httpx`)

**DoD:**
- Cloud API proxies LLM calls and tracks token usage per user.
- `GET /usage` (authed) returns user's token consumption.
- Plan limits enforced: exceeding limit returns 429.
- Engine's `CompassCloudProvider` successfully calls the cloud proxy.

**Depends on:** M3-T1

---

#### M3-T3: Cloud API — Stripe Billing

**Context:**
- Cloud API has auth (M3-T1) and proxy (M3-T2). Now need Stripe integration for plan upgrades.
- Plan tiers: Free (50k tokens/month), Pro ($20/month, 500k tokens/month), Max ($50/month, unlimited).

**Scope:**
1. Create `cloud/compass_cloud/billing.py`:
   - Plan definitions: `PLAN_PRICES`, `PLAN_LIMITS`, `PLAN_DISPLAY`.
   - `create_checkout_session(user, plan)` — creates a Stripe Checkout session.
   - `create_customer(user)` — creates a Stripe customer.
   - `cancel_subscription(user)` — cancels active subscription.
   - `check_token_limit(user)` — check if user is within plan limits.
2. In `cloud/compass_cloud/server.py`, add:
   - `POST /billing/upgrade {"plan": "pro"}` — creates Stripe Checkout session, returns session URL.
   - `GET /billing/plans` — returns plan info with prices and limits.
   - `POST /billing/webhook` — Stripe webhook handler for subscription events (checkout.session.completed, customer.subscription.updated, customer.subscription.deleted).
3. Add `stripe` to `cloud/pyproject.toml` dependencies.

**Files to create:**
- `cloud/compass_cloud/billing.py`

**Files to modify:**
- `cloud/compass_cloud/server.py`
- `cloud/pyproject.toml`

**DoD:**
- `POST /billing/upgrade {"plan": "pro"}` returns a Stripe checkout URL.
- `GET /billing/plans` returns the three plan tiers with pricing.
- Webhook handler updates user plan on successful checkout.
- `POST /billing/webhook` with test Stripe event processes correctly.

**Depends on:** M3-T1

---

#### M3-T4: App — Auth Flow and Usage UI

**Context:**
- Cloud API has auth, proxy, and billing. App needs login/signup UI and usage tracking.
- Currently, settings page shows basic token usage from the local engine.

**Scope:**
1. Add login/signup screens to the app:
   - New page or modal: email + password form.
   - On login/signup: store JWT in localStorage (later: OS keychain).
   - Pass auth token to engine when using Compass Cloud provider.
2. In the sidebar, add a usage progress bar:
   - Show "X% of monthly limit used" based on cloud usage endpoint.
   - When limit is near (80%+), show warning.
   - When limit exceeded, show upgrade prompt linking to Stripe checkout.
3. In settings page:
   - Show logged-in user info.
   - Show current plan.
   - "Upgrade" button that opens Stripe checkout.
   - "Logout" button.
4. Wire auth token to `CompassCloudProvider` via the `/configure` endpoint.

**Files to create:**
- `app/src/pages/LoginPage.tsx` (or `app/src/components/AuthModal.tsx`)

**Files to modify:**
- `app/src/stores/settings.ts` — add auth state (token, user, plan)
- `app/src/components/layout/Sidebar.tsx` — add usage bar
- `app/src/pages/SettingsPage.tsx` — add auth info, plan, upgrade
- `app/src/App.tsx` — add auth routing

**DoD:**
- User can sign up and login from the app.
- Usage bar shows monthly consumption.
- "Upgrade" button redirects to Stripe checkout.
- BYOK users bypass cloud entirely.

**Depends on:** M3-T1, M3-T2, M3-T3

---

### M4: Public Launch (Months 5-7)

**Goal:** Anyone can download, sign up, and use Compass. Connector ecosystem started.

---

#### M4-T1: Additional Connectors — Linear

**Context:**
- Same connector pattern as M1 connectors.
- Linear has a GraphQL API. Support both JSON export and API mode.
- Linear issues are `JUDGMENT` source type.

**Scope:**
1. Create `engine/compass/connectors/linear_connector.py`:
   - Support JSON export and GraphQL API (`config.options.api_key`).
   - Parse issues: identifier, title, description, state, priority, comments.
   - Each issue → one Evidence item.
2. Register in `__init__.py` and `CONNECTOR_SOURCE_MAP`.

**Files to create:**
- `engine/compass/connectors/linear_connector.py`

**Files to modify:**
- `engine/compass/connectors/__init__.py`
- `engine/compass/models/sources.py`

**DoD:**
- `get_connector("linear")` returns `LinearConnector`.
- JSON export mode tested with fixture data.

---

#### M4-T2: Additional Connectors — Notion

**Context:**
- Notion exports as markdown/HTML. Notion API available for live reads.
- Notion pages are `DOCS` source type.

**Scope:**
1. Create `engine/compass/connectors/notion_connector.py`:
   - Support local export directory (markdown files) and Notion API (`config.options.api_key`).
   - For API mode: use Notion SDK or raw HTTP to list pages/databases and read content.
   - Each page → one Evidence item.
2. Register.

**Files to create:**
- `engine/compass/connectors/notion_connector.py`

**Files to modify:**
- `engine/compass/connectors/__init__.py`
- `engine/compass/models/sources.py`

**DoD:**
- `get_connector("notion")` returns `NotionConnector`.
- Local export mode tested.

---

#### M4-T3: Additional Connectors — Amplitude + Zendesk

**Context:**
- Amplitude/Mixpanel export analytics data as CSV/JSON. `DATA` source type.
- Zendesk exports support tickets as JSON. `JUDGMENT` source type.

**Scope:**
1. Create `engine/compass/connectors/amplitude_connector.py`:
   - Reads CSV/JSON analytics exports.
   - Parses event data, metrics, funnels into Evidence items.
2. Create `engine/compass/connectors/zendesk_connector.py`:
   - Reads JSON export or calls Zendesk API.
   - Parses tickets: subject, description, status, comments.
3. Register both.

**Files to create:**
- `engine/compass/connectors/amplitude_connector.py`
- `engine/compass/connectors/zendesk_connector.py`

**Files to modify:**
- `engine/compass/connectors/__init__.py`
- `engine/compass/models/sources.py`

**DoD:**
- Both connectors registered and testable with fixture data.

---

#### M4-T4: Connector SDK

**Context:**
- All connectors follow the same pattern: inherit from `Connector`, implement `validate()` and `ingest()`.
- Want to make this an official SDK so third-party developers can build connectors.

**Scope:**
1. Create `engine/compass/connectors/sdk.py`:
   - Re-export `Connector`, `SourceConfig`, `Evidence`, `SourceType`, `EvidenceStore`.
   - Add comprehensive docstrings explaining how to build a connector.
   - Include an example connector in docstring.
2. Add a `docs/connector-sdk.md` guide:
   - Installation, base class, required methods, evidence model, registration.
   - Example: "Building a Confluence connector" walkthrough.
3. Ensure `Connector` base class in `base.py` has clear docstrings for `validate()` and `ingest()`.

**Files to create:**
- `engine/compass/connectors/sdk.py`
- `docs/connector-sdk.md`

**Files to modify:**
- `engine/compass/connectors/base.py` (docstrings)

**DoD:**
- `from compass.connectors.sdk import Connector, Evidence, SourceType` works.
- SDK guide is clear enough for a developer to build a connector without reading Compass internals.

---

#### M4-T5: CLI v2 — Cloud Auth + Workspace Flag

**Context:**
- `engine/compass/cli.py` has Typer commands: `init`, `connect`, `ingest`, `reconcile`, `discover`, `specify`, `status`.
- Need to add cloud authentication commands and improve CLI for cloud users.

**Scope:**
1. Add commands to `cli.py`:
   - `compass login` — prompt for email/password, call cloud API `/auth/login`, store JWT in `~/.compass/credentials.json`.
   - `compass signup` — prompt for email/password, call cloud API `/auth/signup`, store JWT.
   - `compass whoami` — read stored JWT, call `/auth/me`, display user info.
   - `compass logout` — delete `~/.compass/credentials.json`.
2. Add `--workspace` option to `discover` command (default: current directory).
3. When cloud auth is active, configure the orchestrator to use `CompassCloudProvider` with the stored auth token.

**Files to modify:**
- `engine/compass/cli.py`

**DoD:**
- `compass login` prompts for credentials and stores JWT.
- `compass whoami` shows logged-in user.
- `compass discover --workspace ./my-product` works.

**Depends on:** M3-T1 (cloud auth API must exist)

---

#### M4-T6: Windows + Linux Build Config

**Context:**
- Current build config targets macOS only.
- Electron + electron-builder supports cross-platform builds.

**Scope:**
1. In `package.json` `build` config, add:
   - `win`: target NSIS (`.exe` installer), icon
   - `linux`: target AppImage (`.AppImage`), icon
2. Add `build:win` and `build:linux` scripts.
3. Update `engine-bridge.ts` to handle Windows paths (Python venv is at `.venv/Scripts/python.exe` on Windows).
4. Update `.github/workflows/ci.yml` to optionally build on Windows/Linux runners.

**Files to modify:**
- `app/package.json`
- `app/electron/engine-bridge.ts`
- `.github/workflows/ci.yml`

**DoD:**
- Build config includes Windows and Linux targets.
- `engine-bridge.ts` correctly finds Python on all platforms.
- CI can build on multiple platforms (or at least has the config ready).

---

### M5: Growth + Team Features (Months 8-12)

**Goal:** Teams adopt Compass. Revenue grows. Enterprise pipeline started.

---

#### M5-T1: Team Workspaces

**Context:**
- Cloud API exists (from M3). Currently only handles individual users.
- Teams should be able to share workspace metadata (not evidence — that stays local).

**Scope:**
1. Create `cloud/compass_cloud/teams.py`:
   - Models: `SharedWorkspace` (id, name, owner_id, member_ids), `TeamMember` (user_id, role).
   - Functions: create workspace, invite member, list workspaces for user.
2. Add cloud API endpoints:
   - `POST /teams/workspaces` — create shared workspace
   - `GET /teams/workspaces` — list user's shared workspaces
   - `POST /teams/invite` — invite member to workspace
3. In the app, add a "Share" button on workspace page that creates a cloud workspace and generates an invite link.

**Files to create:**
- `cloud/compass_cloud/teams.py`

**Files to modify:**
- `cloud/compass_cloud/server.py`
- `app/src/pages/WorkspacePage.tsx` (add share UI)

**DoD:**
- Users can create shared workspaces and invite others.
- Workspace metadata is shared; evidence stays local.

**Depends on:** M3-T1

---

#### M5-T2: Continuous Ingestion + Refresh

**Context:**
- Currently, ingestion is manual (click "Ingest" button). Evidence is stale as soon as sources change.
- Need a refresh mechanism for individual sources.

**Scope:**
1. In `server.py`, add `POST /refresh` endpoint:
   - Accept `{workspace_path, source_name?}` — if `source_name` provided, refresh only that source; otherwise refresh all.
   - Don't clear the entire KG — re-ingest the specified source(s), replacing old evidence from that connector.
2. In `knowledge_graph.py`, add `remove_by_connector(connector_name)` method.
3. In the app workspace page, add a "Refresh" button per source (not just the global ingest button).

**Files to modify:**
- `engine/compass/server.py`
- `engine/compass/engine/knowledge_graph.py`
- `app/src/components/workspace/SourceConnector.tsx`

**DoD:**
- "Refresh" on a single source re-ingests only that source.
- Old evidence from that source is replaced, not duplicated.
- Other sources' evidence is unaffected.

---

#### M5-T3: Historical Tracking

**Context:**
- Each discovery run produces a set of opportunities. Want to track these over time.
- "This conflict was first detected 3 months ago" adds significant value.

**Scope:**
1. In `server.py`, after discovery completes, append results to `discovery_history.json` with a timestamp.
2. Add `POST /history` endpoint: returns historical discovery snapshots for a workspace.
3. Add `POST /health/workspace` endpoint: returns workspace health dashboard (evidence count, conflict count, opportunity count, evidence freshness by source).
4. In the app, add a "History" view on the Discover page showing how opportunities have changed over time.

**Files to modify:**
- `engine/compass/server.py`
- `app/src/pages/DiscoverPage.tsx`

**DoD:**
- Multiple discovery runs create a history log.
- History endpoint returns all snapshots.
- App shows a simple timeline of past discoveries.

---

#### M5-T4: Enterprise Scaffolding (SSO + Audit Logs)

**Context:**
- Enterprise customers need SSO (SAML/OIDC) and audit logging.
- This is scaffolding — not full implementation. Provide the data models and API stubs.

**Scope:**
1. Create `cloud/compass_cloud/enterprise.py`:
   - Models: `Organization` (id, name, sso_config, created_at), `SSOConfig` (provider, metadata_url, domain), `AuditLogEntry` (id, org_id, user_id, action, resource, timestamp, metadata).
   - Functions: create org, configure SSO, log audit event, query audit log.
2. Add cloud API endpoints (behind feature flag or org-only auth):
   - `POST /enterprise/org` — create organization
   - `POST /enterprise/sso/configure` — configure SSO
   - `GET /enterprise/audit` — query audit log

**Files to create:**
- `cloud/compass_cloud/enterprise.py`

**Files to modify:**
- `cloud/compass_cloud/server.py`

**DoD:**
- Enterprise models defined.
- API stubs return meaningful responses.
- Audit log captures entries (in-memory for now).

**Depends on:** M3-T1

---

## Part 3: Dependency Graph and Parallel Execution Strategy

### 3.1 Task Dependency Graph

```
M0: Working Demo
═══════════════════════════════════════════════════════

  M0-T1 (KG Persist)   M0-T2 (Settings API)
         │                      │
         ▼                      ▼
  M0-T4 (Workspace)    M0-T3 (App Settings + ErrorBoundary)
         │                      │
         └──────────┬───────────┘
                    ▼
             M0-T5 (Integration)


M1: Dogfood-Ready
═══════════════════════════════════════════════════════

  M1-T1    M1-T2    M1-T3    M1-T4    M1-T5    M1-T6    M1-T7    M1-T8
  (Jira)   (GDocs)  (Slack)  (Prompts) (Chat)  (Tests)  (CI/CD)  (Modes)
    │        │        │         │        │        │        │        │
    └────────┴────────┘         │        │        │        │        │
    All connectors      ────────┘        │        │        │        │
    must land before                     │        │        │        │
    M1-T6 connector tests               │        │        │        │
                                         │        │        │        │
                                         └────────┴────────┴────────┘
                                         All independent, can run in parallel


M2: Private Beta
═══════════════════════════════════════════════════════

  M2-T1          M2-T2          M2-T3          M2-T4
  (Distribution) (Onboarding)   (Spec Export)  (Feedback)
  All independent — can run in parallel


M3: Cloud + Pricing
═══════════════════════════════════════════════════════

  M3-T1 (Auth) ──────────┐
       │                  │
       ▼                  ▼
  M3-T2 (Proxy)    M3-T3 (Billing)
       │                  │
       └──────────┬───────┘
                  ▼
           M3-T4 (App Auth)


M4: Public Launch
═══════════════════════════════════════════════════════

  M4-T1   M4-T2   M4-T3   M4-T4   M4-T5   M4-T6
  (Linear) (Notion) (Amp+ZD) (SDK)  (CLI)   (Win/Linux)
     │       │       │        │       │        │
     └───────┴───────┘        │       │        │
     All independent          │       │        │
                              │       │        │
                    ──────────┘       │        │
                    Depends on              Independent
                    M3-T1 (auth)


M5: Growth + Teams
═══════════════════════════════════════════════════════

  M5-T1        M5-T2        M5-T3        M5-T4
  (Teams)      (Refresh)    (History)    (Enterprise)
     │            │            │            │
  Dep: M3-T1  Independent  Independent  Dep: M3-T1
```

### 3.2 Parallel Execution Strategy

#### Wave 1 (M0 — 2 agents, 1-2 weeks)
| Agent | Tasks | Estimated Time |
|-------|-------|---------------|
| Agent A | M0-T1 (KG Persist) → M0-T4 (Workspace Isolation) | 3-4 hours |
| Agent B | M0-T2 (Settings API) → M0-T3 (App Settings + ErrorBoundary) | 3-4 hours |
| Agent C (after A+B) | M0-T5 (Integration Validation) | 2-3 hours |

#### Wave 2 (M1 — 4 agents, 2-3 weeks)
| Agent | Tasks | Estimated Time |
|-------|-------|---------------|
| Agent A | M1-T1 (Jira) + M1-T2 (GDocs) + M1-T3 (Slack) | 3-4 hours |
| Agent B | M1-T4 (Prompts) + M1-T8 (Agent Modes) | 3-4 hours |
| Agent C | M1-T5 (Chat Streaming + Persistence) | 2-3 hours |
| Agent D | M1-T6 (Tests) + M1-T7 (CI/CD) | 4-5 hours |

_Note: Agent D should run after Agent A (needs connectors for connector tests). Agents B, C can run fully in parallel._

#### Wave 3 (M2 — 4 agents, 3-4 weeks)
| Agent | Tasks | Estimated Time |
|-------|-------|---------------|
| Agent A | M2-T1 (Distribution) | 2-3 hours |
| Agent B | M2-T2 (Onboarding) | 3-4 hours |
| Agent C | M2-T3 (Spec Export) | 1-2 hours |
| Agent D | M2-T4 (Feedback) | 1-2 hours |

_All fully parallel._

#### Wave 4 (M3 — 2 agents, sequential, 4-6 weeks)
| Agent | Tasks | Estimated Time |
|-------|-------|---------------|
| Agent A | M3-T1 (Auth) → M3-T2 (Proxy) | 4-5 hours |
| Agent B (after A) | M3-T3 (Billing) → M3-T4 (App Auth) | 4-5 hours |

_M3-T3 can start as soon as M3-T1 is done (doesn't need M3-T2). M3-T4 needs all three._

#### Wave 5 (M4 — 3 agents, 6-8 weeks)
| Agent | Tasks | Estimated Time |
|-------|-------|---------------|
| Agent A | M4-T1 (Linear) + M4-T2 (Notion) + M4-T3 (Amp+ZD) | 3-4 hours |
| Agent B | M4-T4 (SDK) + M4-T5 (CLI v2) | 3-4 hours |
| Agent C | M4-T6 (Win/Linux) | 2-3 hours |

_All parallel (M4-T5 needs M3-T1 to exist)._

#### Wave 6 (M5 — 2-3 agents, ongoing)
| Agent | Tasks | Estimated Time |
|-------|-------|---------------|
| Agent A | M5-T1 (Teams) + M5-T4 (Enterprise) | 4-5 hours |
| Agent B | M5-T2 (Refresh) + M5-T3 (History) | 3-4 hours |

_Agent B is fully independent. Agent A needs M3 cloud API._

### 3.3 Total Task Count

| Milestone | Tasks | Estimated Agent-Hours |
|-----------|-------|-----------------------|
| M0 | 5 | 12-15 |
| M1 | 8 | 15-20 |
| M2 | 4 | 7-11 |
| M3 | 4 | 12-16 |
| M4 | 6 | 10-14 |
| M5 | 4 | 7-9 |
| **Total** | **31** | **63-85** |

---

## Appendix A: How to Give a Task Card to an Agent

When handing a task card to a Cursor or Claude Code agent, include:

1. **This document's Part 1** (or relevant sections) as context about the codebase.
2. **The specific task card** from Part 2.
3. **Any dependent task cards' outputs** (if the task has dependencies and those are complete).

Example prompt template:

```
You are working on the Compass project — an AI-native product discovery tool.

## Codebase Context
[Paste relevant sections from Part 1: architecture, data models, API contracts]

## Your Task
[Paste the specific task card: M0-T1, M1-T3, etc.]

## Instructions
- Read all files mentioned in the task card before making changes.
- Follow the existing code style and patterns.
- Run tests after your changes if tests exist.
- Do not modify files outside the scope of this task card.
```

## Appendix B: Quick Reference — Key File Paths

```
engine/compass/server.py              # FastAPI server (main engine entry point)
engine/compass/engine/orchestrator.py  # LLM provider abstraction
engine/compass/engine/knowledge_graph.py # ChromaDB + EvidenceStore
engine/compass/engine/reconciler.py    # Source conflict detection
engine/compass/engine/discoverer.py    # Opportunity synthesis
engine/compass/engine/specifier.py     # Spec generation
engine/compass/config.py              # Workspace config (YAML)
engine/compass/cli.py                 # Typer CLI
engine/compass/connectors/base.py     # Connector base class
engine/compass/connectors/__init__.py  # Connector registry
engine/compass/models/sources.py      # Evidence, EvidenceStore, SourceType
engine/compass/models/conflicts.py    # Conflict, ConflictReport
engine/compass/models/specs.py        # Opportunity, FeatureSpec, AgentTask

app/electron/main.ts                  # Electron main process
app/electron/preload.ts               # Context bridge
app/electron/engine-bridge.ts         # Python sidecar lifecycle
app/src/App.tsx                       # React root
app/src/stores/*.ts                   # Zustand state stores
app/src/pages/*.tsx                   # Page components
app/src/types/engine.ts               # TypeScript type mirrors
app/src/hooks/useStreamingChat.ts     # SSE streaming hook (exists, unused)
```
