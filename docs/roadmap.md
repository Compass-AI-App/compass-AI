# Compass Product Roadmap

> From prototype to "Cursor for Product Managers."

**Current state:** v0.1.0 — CLI works but re-ingests on every command, Electron app built but never run end-to-end, 5 connectors, no persistence, no tests, no distribution.

**Target state:** An AI-native product discovery app that connects to all your product's evidence sources, finds where they disagree, and generates agent-ready specifications. Distributed as a native desktop app with MCP integration for power users.

---

## Design Principles

1. **The engine is the brain, the app is the product.** The Python engine does the thinking (reconciliation, discovery, specification). The Electron app is how PMs interact with it — native file pickers, OAuth flows, visual exploration. The CLI and MCP server are power-user interfaces.
2. **Intelligence before interface.** Fix the engine, make the AI output genuinely useful, THEN polish the app. A beautiful app that produces generic recommendations is worthless.
3. **Evidence-grounded or nothing.** Every recommendation cites specific evidence. No hallucinated priorities. If the evidence doesn't support it, Compass doesn't suggest it.
4. **BYOK first, cloud later.** BYOK (Bring Your Own Key) means users provide their own Anthropic API key. This removes the need for cloud infrastructure, billing, and auth in early milestones. Cloud comes after product-market fit is validated.

---

## Milestone Overview

| # | Milestone | Outcome | Timeline |
|---|-----------|---------|----------|
| **M0** | Solid Engine | Engine is reliable — persistence, workspace isolation, no re-ingestion bug | Week 1 |
| **M1** | Intelligence | AI output is genuinely useful — actionable conflicts, evidence-grounded opportunities, implementable specs | Weeks 2-3 |
| **M2** | Killer Demo | One-command demo that shows undeniable value in 60 seconds | Week 4 |
| **M3** | MCP Server | Compass works inside Claude Code and Cursor via MCP protocol | Weeks 5-6 |
| **M4** | Native App | Electron app runs end-to-end — connect sources, ingest, reconcile, discover, specify, chat | Weeks 7-9 |
| **M5** | Beta & Validation | 10 PMs install the `.dmg`, use Compass on real products, give feedback | Weeks 10-14 |
| **M6** | Connectors & Polish | Real-world connectors (Jira, Slack, Linear), onboarding wizard, feedback loop | Months 4-5 |
| **M7** | Cloud & Revenue | Hosted version, no API key needed, Stripe billing, first revenue | Months 6-8 |
| **M8** | Scale | Teams, connector SDK, enterprise scaffolding, historical tracking | Months 9-12 |
| **M9** | Evidence-Grounded Writing | Writer engine: product briefs, stakeholder updates with evidence citations | Month 13 |
| **M10** | Deep Devil's Advocate | Challenger engine: stress-test opportunities against contradicting evidence | Month 13 |
| **M11** | Experiment Design | Experimenter engine: validation experiments grounded in data | Month 14 |
| **M12** | Planning & Enhanced Chat | Planner engine: weekly plans, meeting prep, 8 chat modes | Month 14 |
| **M13** | Data Analysis | Analyst engine: metric interpretation, SQL generation | Month 15 |
| **M14** | Experiment Design (UI) | Experiment button on opportunities, experiment chat mode | Month 15 |
| **M15** | Weekly Planning (UI) | Weekly plan widget, meeting-prep chat mode | Month 15 |
| **M16** | Data Analysis (UI) | Analyze command, data-analyst chat mode | Month 16 |
| **M17** | Auth Infrastructure | OAuth2 PKCE, credential vault, provider registry, connected accounts UI | Month 17 |
| **M18** | Social Auth | Sign in with GitHub/Google, user profiles, cloud auth integration | Month 17 |
| **M19** | Live Connectors (Core) | LiveConnector base, GitHub API, Jira Cloud API, connector mode toggle | Month 18 |
| **M20** | Live Connectors (All) | Slack, Linear, Confluence, Notion, Zendesk live APIs, auto-sync scheduler | Month 19 |
| **M21** | PM Onboarding | Project templates, git auto-creation, push to GitHub, guided onboarding v2 | Month 19 |
| **M22** | Chart Engine | Recharts library, evidence dashboards, opportunity charts, conflict matrix | Month 20 |
| **M23** | Analytics Dashboard | Dashboard engine component, dashboard page, enhanced CSV/Excel import | Month 20 |
| **M24** | Document Editor | Tiptap rich text editor, document storage, documents page, AI generation | Month 21 |
| **M25** | Document Sharing | Multi-format export (MD/HTML/PDF/DOCX), link sharing, evidence citations | Month 21 |
| **M26** | Slide Builder | Presenter engine, slide renderer, presentations page, slide export | Month 22 |
| **M27** | Slide Intelligence | Audience adaptation, speaker notes, chart embedding in slides | Month 22 |
| **M28** | Prototype Builder | Prototyper engine, iframe preview, prototypes page, prototype export | Month 23 |
| **M29** | Prototype Intelligence | Evidence-driven content, component library, A/B variant generation | Month 23 |
| **M30** | Collaboration | Workspace sharing, unified export hub, activity feed, notifications | Month 24 |

---

## M0: Solid Engine

**Week 1**

**Goal:** The engine is reliable. Persistence works. CLI commands don't re-ingest on every call. Workspaces don't bleed into each other. Tests exist for the critical path.

**Why first:** Everything downstream — AI quality, demo, MCP, app, beta — depends on the engine working correctly. Right now it doesn't. `_load_knowledge_graph()` in `cli.py` re-ingests from connectors on every command (line 356-376). `_get_kg()` in `server.py` does the same (line 527-546). `EvidenceStore` is in-memory only. These aren't features to add — they're bugs to fix.

### Tasks

#### M0-T1: KnowledgeGraph Persistence

The core bug: `EvidenceStore` is purely in-memory. ChromaDB persists embeddings, but the structured evidence list vanishes on restart.

**Scope:**
1. Add `_save_store()` to `KnowledgeGraph` — serializes `self._store.items` to `evidence_store.json` in `persist_dir` using Pydantic `.model_dump()` (handle `datetime`)
2. Add `_load_store()` called in `__init__` — loads `evidence_store.json` if it exists
3. Call `_save_store()` at the end of `add()` and `add_many()`
4. In `clear()`, delete `evidence_store.json`
5. Guard `query()` against `n_results=0` when store is empty

**Files:** `engine/compass/engine/knowledge_graph.py`

#### M0-T2: Fix CLI and Server Re-ingestion Bug

`_load_knowledge_graph()` in `cli.py` and `_get_kg()` in `server.py` re-ingest from all connectors every time they're called. After M0-T1, the KG loads from persistence. These functions should just create a `KnowledgeGraph` with the right `persist_dir` and let `_load_store()` handle loading.

**Scope:**
1. Rewrite `_load_knowledge_graph()` in `cli.py` to instantiate `KnowledgeGraph(persist_dir=...)` without re-ingesting. Only fall back to re-ingestion if persistence is empty AND connectors exist (first run after connecting but before explicit ingest)
2. Same fix for `_get_kg()` in `server.py` — remove the re-ingestion loop, rely on persistence

**Files:** `engine/compass/cli.py`, `engine/compass/server.py`

#### M0-T3: Workspace Isolation

`server.py` has a global `_kg` — switching workspaces bleeds data.

**Scope:**
1. Track `_kg_workspace_path` alongside `_kg`
2. If `workspace_path` differs from `_kg_workspace_path`, create a new KG for the new workspace
3. When creating a KG, just instantiate — persistence handles loading

**Files:** `engine/compass/server.py`

#### M0-T4: Runtime Configuration Endpoint

The Electron settings page stores provider/key/model but never sends them to the engine.

**Scope:**
1. Add `configure_orchestrator(api_key, model, provider)` in `orchestrator.py` — creates appropriate `LLMProvider`, preserves `TokenUsage`
2. Add `POST /configure` endpoint in `server.py`
3. Export from `engine/compass/engine/__init__.py`

**Files:** `engine/compass/engine/orchestrator.py`, `engine/compass/engine/__init__.py`, `engine/compass/server.py`

#### M0-T5: Foundation Tests

Can't refactor safely without tests. Cover the critical path — not exhaustive coverage.

**Scope:**
1. `test_models.py`: Evidence creation, EvidenceStore add/query/summary, Conflict, Opportunity, FeatureSpec
2. `test_knowledge_graph.py`: add → persist → reload → verify. Use `tmp_path` fixture
3. `test_connectors.py`: each of the 5 connectors' `validate()` and `ingest()` with fixture files
4. `test_server.py`: FastAPI `TestClient` for `/health`, `/init`, `/connect`, `/ingest`, `/evidence`, `/configure`. Mock orchestrator for LLM endpoints

**Files:** `engine/tests/test_models.py`, `engine/tests/test_knowledge_graph.py`, `engine/tests/test_connectors.py`, `engine/tests/test_server.py` (all new)

#### M0-T6: CI Pipeline

**Scope:**
1. `.github/workflows/ci.yml`: `engine-lint` (ruff), `engine-test` (pytest), `app-typecheck` (tsc --noEmit), `app-build` (vite)
2. Runs on push and PR to `main`

**Files:** `.github/workflows/ci.yml` (new)

### Definition of Done — M0

- [ ] `compass ingest` → stop engine → restart → `compass reconcile` works without re-ingesting. `evidence_store.json` exists in `.compass/knowledge/`.
- [ ] `compass reconcile` runs in < 5 seconds of startup (no connector I/O, just KG load from disk).
- [ ] Open workspace A → ingest → open workspace B → ingest → open workspace A → only A's evidence visible.
- [ ] `POST /configure {"api_key": "sk-ant-...", "model": "claude-sonnet-4-20250514"}` → subsequent LLM calls use the new key.
- [ ] `cd engine && python -m pytest tests/ -v` — all tests pass. No test requires a real API key.
- [ ] Push to branch → CI runs → all jobs pass green.

### Dependency Graph

```
M0-T1 (Persistence)     M0-T4 (Configure)     M0-T6 (CI)
       │                        │                  │
       ▼                        │              (independent)
M0-T2 (Fix re-ingest)          │
       │                        │
       ▼                        │
M0-T3 (Isolation)              │
       │                        │
       └────────────────────────┘
                 │
                 ▼
         M0-T5 (Tests)
```

---

## M1: Intelligence

**Weeks 2-3**

**Goal:** The AI output is genuinely useful. Conflicts are actionable, not trivial. Opportunities cite specific evidence. Specs are detailed enough for a coding agent to execute. A PM looks at the output and thinks "this is better than what I'd produce manually in 2 hours."

**Why now:** The engine works (M0). Now make it smart. This is the product differentiator. If a PM runs `compass discover` and gets generic suggestions that could apply to any product, Compass has failed. Every output must be grounded in the specific evidence from their specific product.

### Tasks

#### M1-T1: Reconciliation Prompt Overhaul

Current `RECONCILE_PROMPT` produces inconsistent quality — too many trivial conflicts, vague descriptions, recommendations that don't help.

**Scope:**
1. Rewrite `RECONCILE_SYSTEM` to be explicit about what constitutes a real conflict vs. a trivial difference:
   - **Real conflict:** Strategy says "real-time sync is P0" but the sync module hasn't been touched in 8 months and has 23 support tickets about failures
   - **Not a conflict:** Strategy doc uses different terminology than the codebase
2. Add 3 few-shot examples to `RECONCILE_PROMPT` — one high-severity, one medium, one that should NOT be flagged
3. Require the LLM to include a `"signal_strength"` field: how many independent evidence items support this conflict
4. Add instruction: "Every conflict must be actionable. If you can't recommend a concrete next step, it's not worth flagging."

**Files:** `engine/compass/engine/reconciler.py`

#### M1-T2: Discovery Prompt Overhaul

Current `DISCOVER_PROMPT` doesn't map `related_conflicts` to `conflict_ids`. Opportunities lack specificity.

**Scope:**
1. Rewrite `DISCOVER_SYSTEM` to emphasize multi-source corroboration:
   - HIGH confidence = 3+ sources agree
   - MEDIUM = 2 sources agree
   - LOW = single source signal
2. Add few-shot examples showing good evidence grounding
3. Fix `related_conflicts` → `conflict_ids` mapping in `Discoverer.discover()`: after parsing LLM response, match conflict titles to actual conflict objects and populate `Opportunity.conflict_ids`
4. Add `evidence_ids` population: match cited evidence titles to actual `Evidence.id` values from the KG
5. Require LLM to cite specific evidence by title, not vague summaries

**Files:** `engine/compass/engine/discoverer.py`

#### M1-T3: Specification Prompt Overhaul

Specs need to be detailed enough that a coding agent can execute them without asking clarifying questions.

**Scope:**
1. Rewrite `SPECIFY_PROMPT` to require:
   - Problem statement that cites specific evidence items (not generic descriptions)
   - Proposed solution broken into numbered steps
   - Each `AgentTask` includes: exact files to modify (inferred from code evidence), testable acceptance criteria, testing requirements
2. Add a "Cursor format" and "Claude Code format" output section — same content, different emphasis:
   - Cursor: task-centric, file paths prominent, less context per task
   - Claude Code: full context per task, reasoning included, step-by-step
3. Add `to_cursor_markdown()` and `to_claude_code_markdown()` methods to `FeatureSpec` model

**Files:** `engine/compass/engine/specifier.py`, `engine/compass/models/specs.py`

#### M1-T4: `compass ask` — CLI Chat Interface

Chat currently only works through the Electron app HTTP endpoints. PMs using the CLI should be able to ask questions too.

**Scope:**
1. Add `compass ask "what frustrates users the most?"` command to `cli.py`
2. Loads KG from persistence (no re-ingestion)
3. Queries KG for relevant evidence, formats prompt with evidence context
4. Streams response using `ask_stream()` with Rich live display
5. Shows cited evidence sources after the response
6. Support `compass ask` with no argument → enters interactive mode (multi-turn, preserves history in `.compass/chat_history.json`)

**Files:** `engine/compass/cli.py`

#### M1-T5: Evidence Provenance & Freshness

No tracking of when evidence was ingested or how fresh it is. Stale evidence produces stale recommendations.

**Scope:**
1. Add `ingested_at: datetime` field to `Evidence` model (set during ingestion, not from source)
2. Add `source_name: str` field to `Evidence` (which `SourceConfig.name` produced this)
3. Add `compass status --health` flag that shows evidence freshness per source:
   ```
   Code (github:my-repo)        17 items    2 hours ago
   Docs (docs:strategy)          4 items    2 hours ago
   Data (analytics:metrics.csv)  3 items    3 days ago  ⚠️ stale
   ```
4. Evidence older than 7 days gets a `⚠️ stale` warning
5. Reconciliation/discovery prompts include freshness context: "Note: analytics data is 3 days old"

**Files:** `engine/compass/models/sources.py`, `engine/compass/cli.py`, `engine/compass/engine/reconciler.py`, `engine/compass/engine/discoverer.py`

#### M1-T6: Incremental Refresh

Currently `compass ingest` clears everything and re-ingests all sources. Should support refreshing a single source.

**Scope:**
1. Add `remove_by_connector(connector_name)` to `KnowledgeGraph` — removes evidence from a specific connector in both `EvidenceStore` and ChromaDB collection
2. Add `compass refresh [source_name]` CLI command — re-ingests one source (or all if no arg), replacing old evidence from that connector
3. Add `POST /refresh` endpoint with optional `source_name` parameter
4. Evidence from other sources is untouched during partial refresh

**Files:** `engine/compass/engine/knowledge_graph.py`, `engine/compass/cli.py`, `engine/compass/server.py`

#### M1-T7: Output Quality Benchmark

Need a repeatable way to measure whether prompt changes actually improve output quality.

**Scope:**
1. Create `engine/tests/test_output_quality.py` (marked as slow/integration, not in default CI run)
2. Run reconciliation against demo data → assert: at least 2 conflicts, no empty recommendations, HIGH severity conflicts reference both sources, no duplicates
3. Run discovery → assert: at least 3 opportunities, ranked, HIGH confidence cites 2+ source types, evidence_summary non-empty
4. Run specification for #1 opportunity → assert: problem_statement cites evidence, at least 2 AgentTasks, each has acceptance_criteria
5. Requires `ANTHROPIC_API_KEY` — excluded from CI, run manually to validate prompt changes

**Files:** `engine/tests/test_output_quality.py` (new)

### Definition of Done — M1

- [ ] **Reconciliation quality:** Run against demo data → every conflict has a concrete recommendation. No trivial conflicts. Signal strength populated. Measurable improvement over M0 output.
- [ ] **Discovery quality:** Every opportunity cites specific evidence by title. `conflict_ids` populated. `evidence_ids` populated. HIGH confidence = 3+ corroborating sources.
- [ ] **Spec quality:** Every `AgentTask` has acceptance criteria and file paths. `to_cursor_markdown()` and `to_claude_code_markdown()` produce distinct, usable formats.
- [ ] **CLI chat:** `compass ask "what frustrates users?"` → evidence-grounded response with citations in < 15 seconds. Interactive mode works.
- [ ] **Freshness:** `compass status --health` shows per-source evidence freshness with stale warnings.
- [ ] **Refresh:** `compass refresh analytics:metrics.csv` → only re-ingests that source. Other evidence untouched.
- [ ] **Benchmark:** `test_output_quality.py` passes against demo data with real API key.
- [ ] **Dogfood test:** Run full pipeline against real product evidence (not demo data). Surfaces at least one insight you didn't already know.

### Dependency Graph

```
M1-T1 (Reconcile prompts)    M1-T4 (CLI ask)    M1-T5 (Provenance)
M1-T2 (Discovery prompts)    M1-T6 (Refresh)
M1-T3 (Spec prompts)
       │                          │                     │
       └──────────────┬───────────┴─────────────────────┘
                      ▼
              M1-T7 (Quality benchmark)
```

**Parallelism:** T1/T2/T3 (prompt work) in parallel with T4/T5/T6 (CLI features). T7 runs last.

---

## M2: Killer Demo

**Week 4**

**Goal:** `pip install compass-ai && compass demo` runs the full pipeline against compelling sample data in under 60 seconds. Anyone watching understands the value immediately. This is the YC application in executable form.

**Why a whole milestone:** The demo is the product's first impression. It's what gets shown at YC, shared on Twitter, embedded in the README. The current demo exists but requires 10 separate commands and doesn't tell a compelling story.

### Tasks

#### M2-T1: `compass demo` Command

**Scope:**
1. Add `compass demo` command that:
   - Creates a temp workspace
   - Connects all 5 demo sources from bundled sample data
   - Ingests (shows progress)
   - Reconciles (shows conflicts with Rich formatting)
   - Discovers (shows ranked opportunities)
   - Generates spec for the #1 opportunity
   - Shows timing: "Compass analyzed 17 evidence items from 5 sources in 47 seconds"
2. `--skip-spec` flag for faster demo without the final LLM call
3. Clean run every time — no pre-existing state required

**Files:** `engine/compass/cli.py`

#### M2-T2: Compelling Sample Data

Rewrite the demo data to tell a clear, surprising story.

**Scope:**
1. Rewrite `demo/sample_data/` to create a tight narrative:
   - **Strategy doc** claims "mobile-first" is the top priority for Q1
   - **Code** shows the mobile module is 2 years old with no recent commits; desktop gets weekly updates
   - **Analytics** show mobile MAU declining 15% while desktop grows 8%
   - **Interviews** have 3 customers asking for mobile improvements, 2 saying "I never use mobile"
   - **Support tickets** have 15 mobile bugs vs. 3 desktop bugs
2. Expected discovery: "Your strategy says mobile-first, but your code and investment say desktop-first. Customers are split. Strategic misalignment."
3. Second story thread: an integration feature customers keep asking for that isn't on the roadmap
4. Realistic formats — real CSV structures, real markdown, realistic code

**Files:** `demo/sample_data/` (all files rewritten)

#### M2-T3: Beautiful CLI Output

Demo-video-ready Rich formatting across all CLI commands.

**Scope:**
1. Polish all Rich output:
   - Ingestion: animated progress bar per source, summary table
   - Reconciliation: color-coded conflict cards (red/yellow/dim), evidence citations inline
   - Discovery: numbered opportunity cards with confidence badges
   - Specification: clean markdown rendering with task checklist
2. Brief "what just happened" explainer after each pipeline step
3. Color-coded source type indicators: `[CODE]` blue, `[DOCS]` green, `[DATA]` yellow, `[JUDGMENT]` purple
4. Final summary: pipeline flow with counts at each stage

**Files:** `engine/compass/cli.py`, `engine/compass/engine/reconciler.py`, `engine/compass/engine/discoverer.py`

#### M2-T4: `pip install compass-ai`

**Scope:**
1. `pyproject.toml`: name `compass-ai`, proper metadata, console script entry point `compass = compass.cli:app`
2. Pin dependencies, ensure clean install pulls everything
3. `[project.optional-dependencies]` for `dev` and `demo`
4. Test: fresh venv → `pip install -e .` → `compass --version` → `compass demo` runs

**Files:** `engine/pyproject.toml`

#### M2-T5: Demo Recording

**Scope:**
1. `demo/record_demo.sh` using `asciinema` or `terminalizer`
2. Instructions for GIF conversion for README
3. `demo/README.md` with setup and expected output

**Files:** `demo/record_demo.sh` (new), `demo/README.md`

### Definition of Done — M2

- [ ] **One command:** `compass demo` runs full pipeline in < 90 seconds. No manual steps.
- [ ] **Story clarity:** Someone watching (who knows nothing about Compass) can explain what it does after seeing the output.
- [ ] **Output quality:** Zero raw JSON, zero tracebacks, zero unformatted text in demo output.
- [ ] **Installable:** Fresh Python 3.11+ venv → `pip install -e .` → `compass demo` works first try.
- [ ] **Recording:** ~60-second terminal recording exists, suitable for YC application.
- [ ] **Surprise test:** Show the demo to a PM who hasn't seen Compass. They identify at least one insight they find genuinely interesting.

---

## M3: MCP Server

**Weeks 5-6**

**Goal:** Compass works inside Claude Code and Cursor via the MCP protocol. A PM can say "what should we build next?" inside their AI tool and get evidence-grounded recommendations without leaving the terminal or editor.

**Why before the app:** MCP is the fastest way to get Compass into real workflows. No app to build, no installer to ship. `compass mcp install` → restart Claude Code → done. It also validates the engine's API surface — if MCP tools work well, the Electron app will work well too (same engine, different interface).

This is what makes "Cursor for PMs" literal: Compass tools appear inside Cursor's chat. The full loop — evidence → discovery → specification → implementation — happens in one conversation.

### Tasks

#### M3-T1: MCP Server Core

**Scope:**
1. Create `engine/compass/mcp_server.py` implementing MCP server protocol (use `mcp` Python SDK)
2. Tools to expose:
   - `compass_status` — workspace health: connected sources, evidence counts, freshness
   - `compass_ingest` — ingest evidence from all connected sources
   - `compass_reconcile` — find conflicts between sources
   - `compass_discover` — synthesize ranked product opportunities
   - `compass_specify` — generate agent-ready spec (param: `opportunity_title`)
   - `compass_ask` — ask a question grounded in evidence (param: `question`)
   - `compass_search` — semantic search across evidence (params: `query`, optional `source_type`)
   - `compass_refresh` — re-ingest specific or all sources (param: optional `source_name`)
3. Each tool returns well-structured markdown readable in a chat interface
4. Reads workspace from cwd (`.compass/`) or `COMPASS_WORKSPACE` env var

**Files:** `engine/compass/mcp_server.py` (new)

#### M3-T2: MCP Configuration & Install

**Scope:**
1. `compass mcp` — prints MCP server config JSON
2. `compass mcp-serve` — starts MCP server (stdio transport)
3. `compass mcp install` — auto-adds Compass to `~/.claude/claude_code_config.json` or `.cursor/mcp.json`
4. `docs/mcp-setup.md` with manual setup instructions

**Files:** `engine/compass/cli.py`, `docs/mcp-setup.md` (new)

#### M3-T3: MCP Tool Output Quality

**Scope:**
1. `compass_discover` — summary paragraph + numbered opportunities with confidence, key evidence, next steps
2. `compass_reconcile` — leads with most important conflict, explains why it matters
3. `compass_specify` — formatted for immediate coding agent execution: task breakdown, file paths, acceptance criteria
4. `compass_ask` — cites evidence naturally inline (not separate citations block)
5. All tools handle gracefully: no workspace, no evidence, stale evidence, API key missing
6. Add `compass_connect` tool for adding sources from within the AI assistant

**Files:** `engine/compass/mcp_server.py`

#### M3-T4: MCP Integration Test

**Scope:**
1. `engine/tests/test_mcp.py`: start MCP server in subprocess → connect with client SDK → call each tool with demo workspace → assert well-formed markdown responses
2. Test `compass mcp install` creates valid config

**Files:** `engine/tests/test_mcp.py` (new)

### Definition of Done — M3

- [ ] **Claude Code:** Add config → ask "what should we build next?" → `compass_discover` returns evidence-grounded opportunities.
- [ ] **Cursor:** Same flow works in Cursor's chat panel.
- [ ] **Full loop:** "What should we build?" → opportunities → "Write the spec for #1" → spec → "Implement task 1" → code written. Evidence → spec → code in one conversation.
- [ ] **Setup time:** `pip install compass-ai && compass mcp install` → working in < 2 minutes.
- [ ] **Error handling:** Missing workspace → clear message. No evidence → "run compass ingest first."
- [ ] **Tests pass:** `test_mcp.py` validates all tools.

---

## M4: Native App

**Weeks 7-9**

**Goal:** The Electron app runs end-to-end — create workspace, connect sources, ingest, reconcile, discover, generate spec, chat — without errors. Data survives restart. A PM can do everything from the GUI that they can do from the CLI.

**Why Electron:** Native app is the right primary interface for PMs. OAuth flows for Jira/Slack/Google need a proper app context. Native file system access for selecting directories and watching for changes. System tray, notifications, dock badges. The target user is a PM — they double-click an app, they don't `pip install`.

**What exists:** The Electron app has 6 pages, 7 Zustand stores, an engine-bridge that spawns Python as a sidecar. It's been built but never run end-to-end. This milestone makes it work.

### Tasks

#### M4-T1: Wire Settings to Engine

**Scope:**
1. `settings.ts`: add `pushToEngine()` that calls `POST /configure` with current settings
2. Call `pushToEngine()` on every settings change and on app startup
3. Persist `apiKey` to localStorage when provider is BYOK
4. In `loadSettings()`, also load `apiKey`

**Files:** `app/src/stores/settings.ts`

#### M4-T2: Error Boundaries

**Scope:**
1. Create `ErrorBoundary.tsx` — React class component with `componentDidCatch`
2. Renders fallback UI with error message + "Try Again" button
3. Styled with Tailwind to match dark theme
4. Wrap app root with `ErrorBoundary` in `App.tsx`
5. Add `useEffect` on mount to call `loadSettings()` + `pushToEngine()`

**Files:** `app/src/components/ErrorBoundary.tsx` (new), `app/src/App.tsx`

#### M4-T3: Streaming Chat

The `useStreamingChat` hook exists but is unused. `ChatPage` uses non-streaming `sendMessage()`.

**Scope:**
1. Wire `useStreamingChat` hook into `ChatPage.tsx`
2. Fix SSE format mismatch between server (`{"token": "..."}`) and hook expectations
3. Add chat history persistence to localStorage per workspace (cap at 100 messages)
4. Citations render alongside streamed responses
5. Add agent mode selector pills: Default, Thought Partner, Technical Analyst, Devil's Advocate
6. Add `agent_mode` field to `ChatRequest` in `server.py` with distinct system prompts per mode

**Files:** `app/src/pages/ChatPage.tsx`, `app/src/stores/chat.ts`, `app/src/hooks/useStreamingChat.ts`, `engine/compass/server.py`

#### M4-T4: Spec Export Actions

**Scope:**
1. Add export buttons to SpecView: "Copy for Cursor", "Copy for Claude Code", "Copy Full Markdown", "Save .md"
2. `formatForCursor(spec)` — task-focused, file paths prominent
3. `formatForClaudeCode(spec)` — full context, step-by-step
4. "Save .md" uses `window.compass.app.saveFile()` for native save dialog

**Files:** `app/src/components/discover/SpecView.tsx`

#### M4-T5: Integration Validation

Run the full flow end-to-end through the UI and fix everything that breaks.

**Scope:**
1. Full walkthrough with demo data: create workspace → connect 5 sources → ingest → evidence page (filter by type) → reconcile (conflicts appear) → discover (opportunities appear) → generate spec → chat ("what are users frustrated about?" → cited response)
2. Restart test: close app → reopen → workspace and evidence persist
3. Fix all bugs found during walkthrough
4. Zero unhandled exceptions in Electron DevTools

**Files:** Any files where bugs are found

### Definition of Done — M4

- [ ] **Full flow:** Create workspace → connect 5 demo sources → ingest → evidence → reconcile → discover → specify → chat — all work without errors.
- [ ] **Settings:** Enter API key in Settings → engine uses it. Change model → subsequent calls use new model.
- [ ] **Streaming:** Chat shows tokens in real-time. Citations appear. Agent modes change the response character.
- [ ] **Persistence:** Close app → reopen → workspace, evidence, and chat history intact.
- [ ] **Error handling:** Force a component error → error boundary shows fallback (not white screen).
- [ ] **Spec export:** "Copy for Cursor" → paste into Cursor → usable prompt. Same for Claude Code.
- [ ] **Console clean:** No unhandled exceptions during full flow.

---

## M5: Beta & Validation

**Weeks 10-14**

**Goal:** 10 PMs install the Compass `.dmg`, use it on their real products, and give structured feedback. At least 3 users complete the full pipeline independently. Their feedback drives the next iteration.

**Why this structure:** Don't build more features. Validate what exists. The biggest risk isn't missing features — it's building the wrong ones. This milestone is about getting the app into real hands and learning what breaks.

### Tasks

#### M5-T1: macOS Distribution

**Scope:**
1. electron-builder config: `.dmg` target, code signing entitlements, `appId: "dev.compass.app"`
2. Bundle Python engine as sidecar resource
3. Auto-updater via `electron-updater` + GitHub Releases
4. `npm run build:mac` → installable `.dmg` in `release/`
5. Test on a clean Mac: double-click `.dmg` → drag to Applications → launch → works

**Files:** `app/package.json`, `app/build/entitlements.mac.plist` (new), `app/electron/main.ts`, `Makefile`

#### M5-T2: Onboarding Wizard

**Scope:**
1. 4-step first-run wizard: Welcome → Create Product → API Key → Connect Sources
2. Step 1: Hero text explaining Compass + "Get Started"
3. Step 2: Product name + description, workspace folder picker (native dialog)
4. Step 3: API key input (explain what it is and where to get it), model selector
5. Step 4: Source type cards, connect at least 1 source
6. Completion: init workspace, save settings, push to engine, navigate to main app
7. Subsequent launches skip onboarding. "Reset onboarding" in settings.

**Files:** `app/src/pages/OnboardingPage.tsx` (new), `app/src/App.tsx`

#### M5-T3: In-App Feedback

**Scope:**
1. Floating feedback button (bottom-right) visible on all pages
2. Click → modal: type (Bug / Feature Request / General), text area, submit
3. Submissions stored locally with timestamp, type, message, app version, workspace stats
4. `compass feedback --export` CLI command to dump all feedback as markdown
5. "Thank you" toast on submit

**Files:** `app/src/components/FeedbackButton.tsx` (new), `app/src/components/layout/AppLayout.tsx`, `engine/compass/cli.py`

#### M5-T4: `compass doctor`

Pre-flight check to help users self-diagnose setup issues.

**Scope:**
1. Checks: Python version, API key set, workspace exists, sources connected, evidence ingested, engine reachable
2. Green/red for each check with fix suggestions
3. `compass doctor --fix` attempts to fix what it can (e.g., create missing dirs)

**Files:** `engine/compass/cli.py`

#### M5-T5: Beta Recruitment & Iteration

Not a code task — operational work.

**Scope:**
1. Recruit 10 PMs (from network, PM communities, Twitter/X)
2. Provide each with: `.dmg` + quickstart guide + Slack/Discord channel for support
3. Watch for: onboarding completion rate, first discovery time, error frequency, feature requests
4. Weekly triage: fix critical bugs immediately, log feature requests, update prompts based on output quality issues
5. Conduct 3-5 user interviews after 2 weeks of usage

**Files:** `docs/quickstart.md` (new), `docs/beta-survey.md` (new)

### Definition of Done — M5

- [ ] **Distribution:** `.dmg` installs on a clean Mac. PM double-clicks → app launches → onboarding starts.
- [ ] **Onboarding:** First launch → wizard → workspace created → first source connected → first ingest — in under 10 minutes.
- [ ] **Reach:** 10 PMs have installed Compass.
- [ ] **Activation:** At least 5 have completed a full pipeline (connect → ingest → discover → specify). At least 3 did it without hand-holding.
- [ ] **Retention:** At least 3 users have run Compass more than once.
- [ ] **Feedback:** At least 5 completed feedback surveys or interviews. Key themes documented.
- [ ] **Doctor works:** `compass doctor` correctly identifies and reports setup issues on beta testers' machines.
- [ ] **Learning documented:** Written summary of what worked, what didn't, what to build next — based on actual user behavior.

---

## M6: Connectors & Polish

**Months 4-5**

**Goal:** Add the connectors beta users actually request. Polish based on feedback. Make the app feel production-grade.

**Why user-driven:** Don't speculate about which connectors matter. The 5 existing connectors (GitHub, docs, analytics, interviews, support) cover all 4 source types. Add Jira, Slack, or Linear only if beta users request them. This milestone's scope depends on M5 feedback.

### Tasks

#### M6-T1: Jira Connector

Most likely request — PMs live in Jira.

**Scope:**
1. `JiraConnector` supporting JSON export and Jira Cloud API (OAuth flow in Electron for API mode)
2. Each issue → one `Evidence` item (`source_type=JUDGMENT`, `connector="jira"`)
3. Content includes: key, summary, description, status, priority, comments

**Files:** `engine/compass/connectors/jira_connector.py` (new), `engine/compass/connectors/__init__.py`, `engine/compass/models/sources.py`

#### M6-T2: Slack Export Connector

**Scope:**
1. `SlackConnector` reads Slack export directories
2. Filters bot/system messages, groups into threads or daily chunks
3. `source_type=JUDGMENT`, `connector="slack"`

**Files:** `engine/compass/connectors/slack_connector.py` (new), `engine/compass/connectors/__init__.py`, `engine/compass/models/sources.py`

#### M6-T3: Linear Connector

For teams using Linear instead of Jira.

**Scope:**
1. `LinearConnector` supporting JSON export and GraphQL API
2. `source_type=JUDGMENT`, `connector="linear"`

**Files:** `engine/compass/connectors/linear_connector.py` (new), `engine/compass/connectors/__init__.py`, `engine/compass/models/sources.py`

#### M6-T4: Feedback-Driven Fixes

Reserve capacity for issues surfaced in M5 beta. Not pre-planned — allocated time.

**Scope:** TBD from M5 feedback. Likely candidates:
- Prompt improvements for specific evidence types
- UI issues: layout, navigation, loading states
- Performance: large evidence sets, slow LLM calls
- Edge cases: unusual file formats, non-English content

#### M6-T5: Notion Connector (If Requested)

**Scope:**
1. `NotionConnector` supporting markdown export and Notion API
2. `source_type=DOCS`, `connector="notion"`

**Files:** `engine/compass/connectors/notion_connector.py` (new)

### Definition of Done — M6

- [ ] **Connectors:** At least 2 new connectors added based on user requests. Each tested with real data from at least 1 beta user.
- [ ] **Total connectors:** 7-8 (5 original + 2-3 new).
- [ ] **Beta satisfaction:** Re-survey beta users → improvement in satisfaction vs. M5 baseline.
- [ ] **Feedback addressed:** Top 3 issues from M5 feedback are fixed.
- [ ] **Stability:** Zero crash reports in the past 2 weeks of beta usage.

---

## M7: Cloud & Revenue

**Months 6-8**

**Goal:** Users can sign up for Compass Cloud, use it without bringing their own API key, and upgrade to a paid plan. Revenue validates the business model.

**Why now:** Product-market fit is validated (M5 beta feedback). The app works (M4). The connector ecosystem is growing (M6). Now remove the barrier of needing an API key. Cloud opens Compass to PMs who aren't technical enough to get an Anthropic key.

**BYOK = Bring Your Own Key.** Users who already have an Anthropic API key continue using it directly — zero cloud dependency. Cloud is for users who want a managed experience.

### Tasks

#### M7-T1: Cloud API — Auth & User Management

**Scope:**
1. FastAPI server in `cloud/`: JWT auth, `POST /auth/signup`, `POST /auth/login`, `GET /auth/me`
2. `User` model: id, email, password_hash, plan, stripe_customer_id, created_at
3. In-memory store for dev, Postgres for production

**Files:** `cloud/` directory (new)

#### M7-T2: Cloud API — LLM Proxy with Metering

**Scope:**
1. `POST /proxy/complete` — authenticated, proxies LLM calls through Compass's own Anthropic key
2. Per-user token usage tracking
3. Plan limit enforcement: Free (50k tokens/month), Pro ($29/month, 500k), Max ($79/month, unlimited)
4. Engine's `CompassCloudProvider` calls proxy with auth token

**Files:** `cloud/compass_cloud/proxy.py`, `engine/compass/engine/orchestrator.py`

#### M7-T3: Stripe Billing

**Scope:**
1. Stripe Checkout sessions, webhook handling for subscription events
2. `GET /billing/plans`, `POST /billing/upgrade`, `POST /billing/webhook`

**Files:** `cloud/compass_cloud/billing.py`, `cloud/compass_cloud/server.py`

#### M7-T4: App + CLI Cloud Integration

**Scope:**
1. App: login/signup screen, usage progress bar in sidebar, "Upgrade" button, plan info in settings
2. CLI: `compass login` / `compass signup` / `compass whoami` / `compass logout`
3. MCP: cloud auth token forwarded through MCP server
4. BYOK users bypass cloud entirely — no login screen, no cloud calls

**Files:** `app/src/pages/LoginPage.tsx` (new), `app/src/stores/settings.ts`, `app/src/components/layout/Sidebar.tsx`, `engine/compass/cli.py`

### Definition of Done — M7

- [ ] **Sign up → use:** New user signs up → gets 50k free tokens → runs discovery → works through cloud proxy.
- [ ] **Billing:** Upgrade to Pro → Stripe Checkout → plan updated → higher limit.
- [ ] **BYOK preserved:** User with own API key → never sees login → zero cloud dependency.
- [ ] **All interfaces:** Cloud works in app, CLI, and MCP.
- [ ] **First revenue:** At least 1 paid subscriber.

---

## M8: Scale

**Months 9-12**

**Goal:** Team adoption, connector ecosystem, enterprise pipeline. Compass goes from a tool to a platform.

### Tasks

#### M8-T1: Team Workspaces
- Shared workspace metadata (evidence stays local — privacy-preserving)
- Invite members, shared opportunity tracking
- Cloud API: `POST /teams/workspaces`, `POST /teams/invite`

#### M8-T2: Connector SDK
- Published SDK: `from compass.connectors.sdk import Connector`
- Guide: "Building a Confluence connector" walkthrough
- Community connectors directory

#### M8-T3: Historical Tracking
- Discovery runs append to `discovery_history.json`
- "This conflict was first detected 3 months ago"
- Opportunity trend tracking — how priorities shift over time

#### M8-T4: Enterprise Scaffolding
- SSO (SAML/OIDC) stubs
- Audit logging for all significant actions
- Organization model

#### M8-T5: Windows + Linux Builds
- electron-builder config for Windows (`.exe`) and Linux (AppImage)
- Platform-specific Python sidecar paths
- CI for multi-platform builds

#### M8-T6: Additional Connectors (User-Driven)
- Build what users request: likely Amplitude, Zendesk, Intercom, Confluence, Productboard
- Each follows the established connector pattern

### Definition of Done — M8

- [ ] **Teams:** 5+ teams using shared workspaces.
- [ ] **Ecosystem:** At least 1 community-built connector via SDK.
- [ ] **History:** PMs see how opportunities evolve over time.
- [ ] **Enterprise:** 2+ enterprise conversations in progress.
- [ ] **Cross-platform:** Windows and Linux builds exist and work.
- [ ] **Scale metrics:** 100+ active users, 3+ paid subscribers.

---

## M9: Make It Real

**Post-M8 — Depth Phase**

**Goal:** The full pipeline works reliably — CLI, app, and MCP. Demo is bulletproof. Zero broken flows. Everything that claims to work actually works when tested end-to-end.

**Why now:** M0-M8 built feature breadth. But the codebase has never been tested by a real user. Onboarding has confirmed bugs, the packaged .dmg won't work on a clean Mac, and MCP has never been tested in a real Claude Code session. This milestone closes the gap between "code exists" and "it works."

### Tasks

#### M9-T1: Fix Onboarding Connect Flow

Confirmed bugs: `handleConnectSource` sends wrong request shape to `/connect`, source_type mapping is wrong, sources are connected before `/init`, "Compass-provided" AI implies a bundled key that doesn't exist.

**Scope:**
1. Fix `handleConnectSource` to send correct `ConnectRequest` shape (`name`, `path` top-level)
2. Call `/init` before any `/connect` calls
3. Remove misleading "Powered by Claude" default — make BYOK the only option
4. Show errors on connection failures

**Files:** `app/src/pages/OnboardingPage.tsx`, `app/src/stores/settings.ts`

#### M9-T2: Engine Sidecar Reliability

`findPython()` falls back to system Python on packaged builds with no deps. Health poll timeout too short. No crash recovery.

**Scope:**
1. First-launch check: create managed venv in `~/Library/Application Support/Compass/`, install deps
2. Increase health poll timeout to 30s
3. Show "Starting engine..." status in app
4. Handle engine crash: detect exit, show restart prompt

**Files:** `app/electron/engine-bridge.ts`, `app/electron/main.ts`, `app/src/App.tsx`

#### M9-T3: End-to-End CLI Smoke Test

**Scope:**
1. `engine/tests/test_e2e_cli.py`: temp workspace → init → connect → ingest → reconcile → discover
2. Mock LLM for CI, separate `@pytest.mark.slow` class for real API key
3. Assert persistence files exist, structural validity of outputs

**Files:** `engine/tests/test_e2e_cli.py` (new)

#### M9-T4: MCP Server Validation

**Scope:**
1. Test `compass mcp-serve` starts and responds to MCP handshake
2. Fix workspace resolution edge cases
3. Verify `compass mcp install` writes correct config
4. Rewrite `docs/mcp-setup.md` with tested instructions

**Files:** `engine/compass/cli.py`, `engine/compass/mcp_server.py`, `docs/mcp-setup.md`

#### M9-T5: Tighten Demo Narrative

**Scope:**
1. Audit sample data against connector `ingest()` for correct parsing
2. Sharpen strategy doc sync priority so conflict is undeniable
3. Add retention/churn data to analytics CSV
4. Add more support tickets with quotable complaints

**Files:** `demo/sample_data/` (strategy, analytics, support, code)

### Definition of Done — M9

- [ ] `compass demo` runs clean 5/5 times with real API key, surfaces HIGH-confidence sync conflict consistently
- [ ] Onboarding wizard completes end-to-end: workspace → API key → sources → ingest → workspace page
- [ ] MCP server works in Claude Code with documented setup instructions
- [ ] `pytest tests/` (excluding slow) passes
- [ ] Engine sidecar starts reliably with "Starting engine..." status visible

### Dependency Graph

```
M9-T1 (Fix onboarding)     M9-T5 (Demo narrative)     M9-T2 (Engine sidecar)
       │                          │                            │
       ▼                          ▼                       (independent)
M9-T3 (E2E smoke test)     M9-T4 (MCP validation)
```

---

## M10: First 10 Users

**Goal:** 10 PMs install Compass, run it on their real data, complete the pipeline. At least 5 return for a second use.

**Why this shape:** M9 made it reliable. M10 makes it installable and usable by someone who isn't the developer.

### Tasks

#### M10-T1: Bulletproof `pip install`

**Scope:**
1. Verify `pyproject.toml` entry point works for non-editable install
2. Pin dependency versions
3. Enhance `compass doctor` with comprehensive checks
4. Publish to PyPI as `compass-ai`

**Files:** `engine/pyproject.toml`, `engine/compass/cli.py`

#### M10-T2: "Your Product in 5 Minutes" Quickstart

**Scope:**
1. Rewrite `docs/quickstart.md` with tested exact commands
2. Add `compass quickstart` interactive CLI command
3. Minimal setup: 1 code repo + 1 docs folder + 1 CSV

**Files:** `docs/quickstart.md`, `engine/compass/cli.py`

#### M10-T3: Connector Robustness

**Scope:**
1. GitHubConnector: binary files, symlinks, .gitignore
2. AnalyticsConnector: delimiter detection, .xlsx support
3. InterviewConnector: .docx, non-UTF-8 encoding
4. DocsConnector: nested dirs, .pdf support
5. All: per-file error handling, --verbose flag

**Files:** `engine/compass/connectors/` (all), `engine/pyproject.toml`

#### M10-T4: macOS .dmg That Works

**Scope:**
1. Fix extraResources engine bundling
2. Integrate first-launch bootstrap from M9-T2
3. Self-sign for development distribution
4. Test on clean Mac end-to-end

**Files:** `app/package.json`, `app/electron/engine-bridge.ts`, `app/build/entitlements.mac.plist`

### Definition of Done — M10

- [ ] `pip install compass-ai && compass doctor && compass demo` works in fresh Python 3.11+ venv
- [ ] PM follows quickstart → first `compass discover` in <5 minutes with their own data
- [ ] Connectors handle 3+ real-world data variations without crashing
- [ ] .dmg installs and runs on a clean Mac without developer help
- [ ] 10 PMs installed. 5 completed pipeline. 3 used it twice.

### Dependency Graph

```
M10-T1 (pip install)     M10-T3 (Connector robustness)     M10-T4 (.dmg)
       │                          │                               │
       ▼                          │                          (independent)
M10-T2 (Quickstart)              │
```

---

## M11: Prove Value

**Goal:** Compass surfaces insights PMs didn't already know. Output quality is the moat. Users recommend it to other PMs.

**Why this matters:** A reliable tool that produces generic output is worthless. The value proposition is "Compass found something you missed." This milestone makes that true consistently.

### Tasks

#### M11-T1: Insight Quality Feedback ("Surprise Score")

**Scope:**
1. After `compass discover`, prompt: "Which surprised you?" → `.compass/feedback.json`
2. In app: thumbs up / star (new insight) / thumbs down on each opportunity
3. `compass quality`: aggregate stats across runs

**Files:** `engine/compass/cli.py`, `app/src/components/discover/OpportunityCard.tsx`, `engine/compass/engine/history.py`

#### M11-T2: Cross-Run Insight Tracking

**Scope:**
1. Append each discovery run to `.compass/discovery_history.json`
2. Compare: flag `[NEW]`, `[PERSISTENT x3]`, `[RESOLVED]`
3. `compass history`: evolution over last N runs
4. Timeline view in app Discover page

**Files:** `engine/compass/engine/history.py`, `engine/compass/engine/discoverer.py`, `engine/compass/cli.py`, `app/src/pages/DiscoverPage.tsx`

#### M11-T3: Evidence Traceability

**Scope:**
1. `compass evidence <id>`: full item with metadata
2. Clickable citations in app → navigate to evidence
3. Source chain in specs: task → opportunity → conflict → evidence
4. `GET /evidence/<id>` endpoint

**Files:** `engine/compass/cli.py`, `engine/compass/server.py`, `app/src/components/discover/OpportunityCard.tsx`

#### M11-T4: Prompt Tuning Pipeline

**Scope:**
1. Extract prompts to `engine/compass/prompts/` with versions
2. Record prompt version per run alongside quality feedback
3. `test_prompt_regression.py`: compare old vs new prompts
4. `compass discover --prompt-version=v2` for A/B testing

**Files:** `engine/compass/prompts/` (new), reconciler.py, discoverer.py, specifier.py

#### M11-T5: Shareable Insight Report

**Scope:**
1. `compass report`: polished markdown report
2. `compass report --format=html`: self-contained HTML
3. "Export Report" button in app Discover page

**Files:** `engine/compass/cli.py`, `engine/compass/engine/reporter.py` (new), `app/src/pages/DiscoverPage.tsx`

### Definition of Done — M11

- [ ] 30%+ opportunities rated as "new insight" across user sessions
- [ ] Cross-run tracking works across 3+ runs for 5+ users
- [ ] Every spec claim traceable to evidence in 2 clicks
- [ ] Prompt changes testable against regression suite
- [ ] 2+ PMs shared a Compass report with their team
- [ ] 1+ PM recommended Compass unprompted

### Dependency Graph

```
M11-T1 (Surprise score)     M11-T3 (Traceability)     M11-T5 (Report)
       │                          │                     (independent)
       ▼                          │
M11-T4 (Prompt tuning)           │
       │                          │
       └──────────┬───────────────┘
                  ▼
M11-T2 (Cross-run tracking)
```

---

## M12: Evidence-Grounded Writing

**Goal:** PMs write briefs, updates, and PRDs grounded in actual evidence — not vibes. Every document cites real data from connected sources.

**Why now:** Writing is the highest-frequency PM activity. Evidence grounding is the clearest differentiator vs. generic AI writing tools.

### Tasks

#### M12-T1: Writer Engine Component

Add `engine/compass/engine/writer.py` with `Writer` class following the established engine pattern (constructor takes KG + model + prompt_version).

**Scope:**
1. `write_brief(opportunity_title)` — queries KG for evidence related to the opportunity, generates a structured product brief with problem statement, proposed solution, requirements (P0/P1/P2), success metrics, and evidence citations
2. `write_update(days=7)` — queries recent evidence by timestamp, runs lightweight source comparison, generates stakeholder update with changes by source type, new signals, risks, and next steps
3. Both methods use versioned prompts from the registry

**Files:** `engine/compass/engine/writer.py` (new), `engine/compass/prompts/write_brief_v1.py` (new), `engine/compass/prompts/write_update_v1.py` (new)

#### M12-T2: Document Models

Pydantic models for writer output.

**Scope:**
1. `ProductBrief` — title, problem_statement, proposed_solution, requirements (list with priority), success_metrics, evidence_citations, target_audience, risks
2. `StakeholderUpdate` — period, summary, changes_by_source (dict), new_signals (list), risks (list), next_steps (list), evidence_freshness
3. Helper for rendering both as markdown

**Files:** `engine/compass/models/documents.py` (new)

#### M12-T3: CLI + API + MCP Endpoints

Expose writer through all interfaces.

**Scope:**
1. CLI: `compass write-brief <opportunity>`, `compass write-update --since 7d`
2. HTTP: `POST /write/brief`, `POST /write/update`
3. MCP: `compass_write_brief(title)`, `compass_write_update(days)`
4. All return markdown by default, structured JSON with `--format json`

**Files:** `engine/compass/cli.py`, `engine/compass/server.py`, `engine/compass/mcp_server.py`

#### M12-T4: App Integration

**Scope:**
1. "Write Brief" button on OpportunityCard (next to "Generate Spec")
2. "Write Update" button on workspace page header
3. Both open a document viewer (reuse SpecView pattern with markdown rendering)
4. Add "writer" agent mode to chat store and server

**Files:** `app/src/components/discover/OpportunityCard.tsx`, `app/src/pages/WorkspacePage.tsx`, `app/src/stores/chat.ts`, `engine/compass/server.py`

### Definition of Done — M12

- [ ] `compass write-brief "opportunity"` generates a brief citing evidence from the KG
- [ ] `compass write-update --since 7d` generates a stakeholder update with changes by source
- [ ] Brief includes P0/P1/P2 requirements and success metrics
- [ ] Update includes evidence freshness ("Data source last refreshed 3 days ago")
- [ ] Both available via CLI, HTTP API, MCP tool, and Electron app
- [ ] Writer chat agent mode works in ChatPage

### Dependency Graph

```
M12-T1 (Writer engine)  ──→  M12-T3 (CLI + API + MCP)
       │                              │
       ▼                              ▼
M12-T2 (Document models)     M12-T4 (App integration)
```

T1 and T2 are independent. T3 depends on T1+T2. T4 depends on T3.

---

## M13: Deep Devil's Advocate

**Goal:** Structured stress-testing of opportunities against real evidence. Not just a system prompt — a full engine that finds contradictions, gaps, and assumptions.

### Tasks

#### M13-T1: Challenger Engine

**Scope:**
1. `challenge(opportunity_title)` — finds evidence that contradicts the opportunity, identifies assumptions not backed by any source, checks evidence staleness, surfaces risks from conflict history
2. Queries KG for both supporting AND contradicting evidence
3. Cross-references with conflict report to find related unresolved conflicts

**Files:** `engine/compass/engine/challenger.py` (new), `engine/compass/prompts/challenge_v1.py` (new)

#### M13-T2: Challenge Model

**Scope:**
1. `Challenge` — weaknesses (list), missing_evidence (list), assumptions (list), risks (list), evidence_quality_score (float), contradicting_evidence (list of evidence IDs)
2. Markdown rendering with severity indicators

**Files:** `engine/compass/models/challenges.py` (extend existing or new)

#### M13-T3: CLI + API + MCP

**Scope:**
1. CLI: `compass challenge <opportunity>`
2. HTTP: `POST /challenge`
3. MCP: `compass_challenge(opportunity_title)`

**Files:** `engine/compass/cli.py`, `engine/compass/server.py`, `engine/compass/mcp_server.py`

#### M13-T4: App Integration

**Scope:**
1. "Challenge" button on each OpportunityCard
2. Challenge results shown as slide-over panel (similar to SpecView)
3. Contradicting evidence items are clickable (link to EvidencePage)

**Files:** `app/src/components/discover/OpportunityCard.tsx`, `app/src/components/discover/ChallengeView.tsx` (new)

### Definition of Done — M13

- [ ] Challenging an opportunity surfaces specific contradicting evidence
- [ ] Missing evidence gaps are identified ("No user data supports this claim")
- [ ] Assumptions listed with which sources they rely on
- [ ] Evidence quality score reflects staleness and coverage

### Dependency Graph

```
M13-T1 (Challenger engine)  ──→  M13-T3 (CLI + API + MCP)
       │                                  │
       ▼                                  ▼
M13-T2 (Challenge model)         M13-T4 (App integration)
```

---

## M14: Experiment Design

**Goal:** Natural extension of "build X" to "validate X first." Every opportunity gets a testable hypothesis and experiment design grounded in actual metrics.

### Tasks

#### M14-T1: Experimenter Engine

**Scope:**
1. `design_experiment(opportunity_title)` — uses data-source evidence to suggest baseline metrics, estimate effect sizes, recommend experiment type (A/B test, feature flag, user study)
2. Pulls analytics evidence to ground sample size and duration estimates in real data

**Files:** `engine/compass/engine/experimenter.py` (new), `engine/compass/prompts/experiment_v1.py` (new)

#### M14-T2: Experiment Model

**Scope:**
1. `ExperimentDesign` — hypothesis, experiment_type, primary_metric, guardrail_metrics, sample_size, duration_estimate, success_criteria, risks, evidence_citations

**Files:** `engine/compass/models/experiments.py` (new)

#### M14-T3: CLI + API + MCP

`compass experiment <opportunity>`, `POST /experiment`, `compass_experiment` MCP tool.

**Files:** `engine/compass/cli.py`, `engine/compass/server.py`, `engine/compass/mcp_server.py`

#### M14-T4: App Integration

"Design Experiment" button in SpecView after generating a spec.

**Files:** `app/src/components/discover/SpecView.tsx`, `app/src/components/discover/ExperimentView.tsx` (new)

### Definition of Done — M14

- [ ] `compass experiment "opportunity"` generates experiment design with hypothesis and metrics
- [ ] Sample size grounded in ingested analytics data when available
- [ ] Experiment type recommendation with rationale

---

## M15: Planning & Enhanced Chat

**Goal:** Compass becomes the first thing PMs open in the morning. Weekly planning dashboard synthesizes everything that changed across sources.

### Tasks

#### M15-T1: Planner Engine

**Scope:**
1. `plan_week()` — synthesizes cross-run tracking deltas, evidence freshness, open opportunities with confidence trends, unresolved conflicts
2. Returns structured weekly plan with focus areas and suggested actions

**Files:** `engine/compass/engine/planner.py` (new), `engine/compass/prompts/plan_week_v1.py` (new)

#### M15-T2: Weekly Plan Model

`WeeklyPlan` with `focus_areas[]`, `stale_sources[]`, `new_signals[]`, `confidence_changes[]`, `suggested_actions[]`

**Files:** `engine/compass/models/planning.py` (new)

#### M15-T3: Meeting Prep Chat Mode

Enhanced agent mode that pulls product state, recent conflicts, open opportunities into meeting prep context. "Prep me for the eng sync about sync reliability."

**Files:** `engine/compass/server.py`, `app/src/stores/chat.ts`

#### M15-T4: App Dashboard Widget

Weekly plan as the workspace landing experience. Replace empty state with actionable summary.

**Files:** `app/src/pages/WorkspacePage.tsx`, `app/src/components/workspace/WeeklyPlan.tsx` (new)

### Definition of Done — M15

- [ ] Opening Compass shows weekly summary of what changed across sources
- [ ] Stale sources flagged with "last refreshed N days ago"
- [ ] Meeting prep mode produces context-aware talking points
- [ ] `compass plan-week` CLI command works

---

## M16: Data Analysis

**Goal:** PMs go from "the data says X" to actually querying and exploring the data, with evidence context guiding what to look for.

### Tasks

#### M16-T1: Analyst Engine

`analyze(question)` and `interpret_metrics(evidence_ids)` — deeper metric interpretation from ingested analytics.

**Files:** `engine/compass/engine/analyst.py` (new), `engine/compass/prompts/analyze_data_v1.py` (new)

#### M16-T2: SQL Generation

If analytics evidence contains structured data, generate investigative queries. "Your conflict says usage is declining — here's the query to check."

**Files:** `engine/compass/engine/analyst.py`

#### M16-T3: App Integration

Data analyst chat mode with metric interpretation output.

**Files:** `engine/compass/server.py`, `app/src/stores/chat.ts`

### Definition of Done — M16

- [ ] PM asks "why is retention dropping?" and gets evidence-grounded analysis
- [ ] Suggested queries generated when analytics data is available
- [ ] Data analyst chat mode works in app

---

## Execution Strategy

### The critical path

```
M0-M8 (Build) → M9-M11 (Depth) → M12-M16 (Full PM Toolkit)
```

**M0 through M8:** Feature breadth — engine, intelligence, demo, MCP, app, beta infra, connectors, cloud scaffolding, scale scaffolding. ✅ Complete.

**M9 through M11:** Depth phase — reliability, distribution, proof of value. ✅ Complete.

**M12 through M16:** PM toolkit phase — evidence-grounded writing, stress-testing, experiment design, planning, data analysis.

### Parallel execution

| Phase | Milestones | Tasks | Status |
|-------|-----------|-------|--------|
| Foundation | M0 (6 tasks) | Engine reliability | ✅ Complete |
| Intelligence | M1 (7 tasks) | AI output quality | ✅ Complete |
| Demo | M2 (5 tasks) | Killer demo | ✅ Complete |
| MCP | M3 (4 tasks) | MCP server | ✅ Complete |
| App | M4 (5 tasks) | Electron app | ✅ Complete |
| Beta | M5 (5 tasks) | Distribution infra | ✅ Complete |
| Polish | M6 (5 tasks) | Connectors | ✅ Complete |
| Cloud | M7 (4 tasks) | Cloud scaffolding | ✅ Complete |
| Scale | M8 (6 tasks) | Enterprise scaffolding | ✅ Complete |
| Make It Real | M9 (5 tasks) | E2E reliability | ✅ Complete |
| First Users | M10 (4 tasks) | Real-world distribution | ✅ Complete |
| Prove Value | M11 (5 tasks) | Insight quality | ✅ Complete |
| Writing | M12 (4 tasks) | Evidence-grounded writing | ✅ Complete |
| Challenge | M13 (4 tasks) | Deep devil's advocate | ✅ Complete |
| Experiments | M14 (4 tasks) | Experiment design | ✅ Complete |
| Planning | M15 (4 tasks) | Weekly planning & chat | ✅ Complete |
| Analysis | M16 (3 tasks) | Data analysis | ✅ Complete |

### Total: 80 tasks across 17 milestones

### What success looks like

| After M0 | After M1 | After M2 | After M3 | After M4 |
|----------|----------|----------|----------|----------|
| "It doesn't break" | "It's actually useful" | "Watch this" | "It works in Cursor" | "There's an app" |

| After M5-M8 | After M9 | After M10 | After M11 |
|-------------|----------|-----------|-----------|
| "Infrastructure exists" | "It actually works" | "10 PMs use it" | "They tell other PMs" |

| After M12 | After M13 | After M14 | After M15-M16 |
|-----------|-----------|-----------|---------------|
| "It writes my briefs" | "It catches my blind spots" | "It designs my experiments" | "It runs my week" |

### Interfaces and their roles

| Interface | Role | When |
|-----------|------|------|
| **Electron App** | Primary product for PMs. Visual exploration, OAuth flows, native file access. | M4 onward |
| **CLI** | Power-user interface. Scripting, demos, diagnostics. | M0 onward |
| **MCP Server** | Integration layer. Compass inside Claude Code, Cursor, and future AI tools. | M3 onward |
| **HTTP API** | Internal bridge. Electron and MCP both call the FastAPI engine. | M0 onward |

---

## Phase 9: Full PM Platform (M17-M30)

> Transform Compass from a discovery tool into the 1-stop-shop for PMs.

### Architecture Principles

1. **Engine pattern preserved.** Every new component: `Component(KG, model, prompt_version)` → query KG → `ask_json` → Pydantic model → 4 interfaces
2. **OAuth tokens never touch engine disk.** Electron vault (safeStorage) stores credentials. Engine receives tokens at runtime via injection endpoint, holds in memory only
3. **LiveConnector is additive.** Every connector keeps file-import mode. Live API mode activates when credentials are available
4. **HTML-first for generated content.** Prototypes = self-contained HTML + Tailwind CDN in sandboxed iframe. Slides = styled React cards

### Dependency Graph

```
M17 (Auth Infrastructure) ─────┬──→ M18 (Social Auth)
                                ├──→ M19 (GitHub/Jira Live) → M20 (All Live Connectors)
                                └──→ M21 (PM Onboarding)

M22 (Chart Engine) → M23 (Dashboards)
                  └──→ M27 (Charts in Slides)

M24 (Document Editor) → M25 (Doc Sharing/Export)

M26 (Slide Builder) → M27 (Slide Intelligence)

M28 (Prototype Builder) → M29 (Prototype Intelligence)

M30 (Collaboration) — depends on all above
```

---

## M17: OAuth Infrastructure & Credential Vault

**Objective:** Build the plumbing for OAuth tokens, API keys, and SSO credentials.

### Tasks

#### M17-T1: Credential Vault in Electron

**Scope:**
- Extend existing `safeStorage` system in `app/electron/main.ts`
- Namespaced storage: `connector:{service}:{field}` pattern
- IPC: `secrets-store-credential`, `secrets-load-credential`, `secrets-delete-credential`, `secrets-list-credentials`
- Credentials as `{access_token, refresh_token, expires_at, scopes, provider}` JSON blobs
- Expose via `window.compass.credentials.store/load/delete/list` in preload.ts

**Files:** `app/electron/main.ts`, `app/electron/preload.ts`, `app/src/types/credentials.ts` (create)

**DoD:** Store/retrieve/delete typed credential objects per service, encrypted at rest

#### M17-T2: SourceConfig Auth Extension

**Deps:** M17-T1

**Scope:**
- Add `auth: AuthConfig | None = None` to `SourceConfig` in `engine/compass/config.py`
- `AuthConfig`: `{method: "oauth"|"api_key"|"pat", credential_ref: str, scopes: list[str]}`
- `credential_ref` is a logical key (e.g. `"github"`) mapping to Electron vault
- Add `POST /credentials/inject` endpoint so Electron passes decrypted tokens at runtime

**Files:** `engine/compass/config.py`, `engine/compass/models/auth.py` (create), `engine/compass/server.py`

**DoD:** SourceConfig references credentials; engine receives tokens via runtime injection

#### M17-T3: OAuth2 PKCE Flow in Electron

**Deps:** M17-T1

**Scope:**
- Generic OAuth2 Authorization Code + PKCE in Electron main process
- `BrowserWindow` opens provider auth URL, captures redirect via `compass://oauth/callback` protocol
- Register `compass://` via `app.setAsDefaultProtocolClient`
- Token exchange in main process (not renderer). Auto-refresh when `expires_at` approaching

**Files:** `app/electron/oauth.ts` (create), `app/electron/main.ts`

**DoD:** Generic OAuth flow usable by any provider via `{auth_url, token_url, client_id, scopes}`

#### M17-T4: OAuth Provider Registry

**Deps:** M17-T3

**Scope:**
- Provider configs for: GitHub, Google, Slack, Atlassian (Jira+Confluence), Linear, Notion
- Per provider: `{id, name, auth_url, token_url, client_id, scopes, icon}`
- Scopes: GitHub (`repo`, `read:org`, `read:user`), Google (`drive.readonly`, `documents.readonly`), Slack (`channels:history`, `channels:read`, `search:read`, `users:read`), Atlassian (`read:jira-work`, `read:confluence-content.all`), Linear (`read`), Notion (`read_content`, `read_user`)

**Files:** `app/electron/oauth-providers.ts` (create), `app/electron/oauth.ts`

**DoD:** Provider registry; can initiate OAuth for any registered provider

#### M17-T5: Connected Accounts Settings UI

**Deps:** M17-T4

**Scope:**
- "Connected Accounts" section in SettingsPage
- Show services with status (connected/expired/disconnected)
- "Connect" triggers OAuth, "Disconnect" revokes + clears
- Also support API key / PAT entry (Linear, Zendesk)

**Files:** `app/src/pages/SettingsPage.tsx`, `app/src/components/settings/ConnectedAccounts.tsx` (create), `app/src/stores/credentials.ts` (create)

**DoD:** User can connect/disconnect OAuth providers and enter API keys from Settings

---

## M18: Social Auth (Sign in with GitHub/Google)

**Deps:** M17 complete

### Tasks

#### M18-T1: Social Auth Flow

**Scope:**
- "Sign in with GitHub" / "Sign in with Google" on LoginPage
- Reuse M17-T3 OAuth flow. Token doubles as app auth + service credential
- BYOK users who skip login remain anonymous locally — social auth is optional

**Files:** `app/src/pages/LoginPage.tsx`, `app/electron/oauth.ts`

**DoD:** Users can sign in with GitHub or Google

#### M18-T2: User Profile Store

**Deps:** M18-T1

**Scope:**
- Fetch profile (name, email, avatar) from provider API after auth
- Zustand store, display avatar + name in sidebar bottom
- Persist: localStorage (non-sensitive) + keychain (tokens)

**Files:** `app/src/stores/auth.ts` (create), `app/src/components/layout/Sidebar.tsx`

**DoD:** User profile in sidebar, persists across restarts

#### M18-T3: Cloud Auth Integration

**Scope:**
- `POST /auth/oauth` endpoint accepts provider token, creates/links Cloud account
- Replaces current email/password flow

**Files:** `cloud/compass_cloud/auth.py`, `cloud/compass_cloud/server.py`

**DoD:** Social auth tokens exchangeable for Cloud tokens

---

## M19: LiveConnector Base + GitHub/Jira

**Deps:** M17 complete

### Tasks

#### M19-T1: LiveConnector Base Class

**Scope:**
- Add `LiveConnector(Connector)` in `engine/compass/connectors/live_base.py`
- `auth_config`, `_get_token()`, `_api_get/post()` (HTTP helpers with auth headers)
- Rate limiting (token bucket) and retry logic built into base
- Existing file connectors unchanged — additive

**Files:** `engine/compass/connectors/base.py`, `engine/compass/connectors/live_base.py` (create)

**DoD:** LiveConnector base with HTTP helpers, rate limiting, token injection

#### M19-T2: GitHub Live Connector

**Deps:** M19-T1

**Scope:**
- When `auth` is set, use GitHub REST API: repo metadata, README, commits, issues, PRs, org repos
- Falls back to local file ingestion when no auth
- Use `httpx` (already a dependency)

**Files:** `engine/compass/connectors/github_connector.py`

**DoD:** GitHub fetches live data via API when credentials available

#### M19-T3: Jira Cloud Live Connector

**Deps:** M19-T1

**Scope:**
- Jira Cloud REST API v3 (`{site}.atlassian.net/rest/api/3/`)
- JQL queries: project-scoped, last 30 days. Fetch issues, comments, sprints
- Falls back to JSON import when no auth

**Files:** `engine/compass/connectors/jira_connector.py`

**DoD:** Jira fetches live issues via API when credentials available

#### M19-T4: Connector Mode Toggle UI

**Scope:**
- "Live API" vs "File Import" toggle in SourceConnector
- Live mode checks credentials store, shows "Connect {Service}" if not connected
- Connected state shows sync status (last synced, item count)

**Files:** `app/src/components/workspace/SourceConnector.tsx`, `app/src/components/workspace/ConnectorModeToggle.tsx` (create)

**DoD:** Users choose live vs file mode per source

---

## M20: Remaining Live Connectors

**Deps:** M19 complete

### Tasks

#### M20-T1: Slack Live Connector

**Scope:** Slack Web API (`conversations.list/history`, `search.messages`). Rate: Tier 3 (50 req/min). Falls back to export directory.

**Files:** `engine/compass/connectors/slack_connector.py`

**DoD:** Slack fetches live channel data via API when credentials available

#### M20-T2: Linear Live Connector

**Scope:** Linear GraphQL API. Auth via API key or OAuth. Fetch issues, projects, cycles. Falls back to JSON export.

**Files:** `engine/compass/connectors/linear_connector.py`

**DoD:** Linear fetches live data via API when credentials available

#### M20-T3: Confluence Live Connector

**Scope:** Atlassian REST v2. Shares OAuth token with Jira. Fetch pages by space, convert ADF to text. Falls back to export.

**Files:** `engine/compass/connectors/confluence_connector.py`

**DoD:** Confluence fetches live pages via API when credentials available

#### M20-T4: Notion Live Connector

**Scope:** Notion API v1. Fetch databases, pages, block children → text. Falls back to markdown export.

**Files:** `engine/compass/connectors/notion_connector.py`

**DoD:** Notion fetches live pages via API when credentials available

#### M20-T5: Zendesk Live Connector

**Scope:** Zendesk REST API. Auth via token pair or OAuth. Fetch tickets, comments, satisfaction. Falls back to export.

**Files:** `engine/compass/connectors/zendesk_connector.py`

**DoD:** Zendesk fetches live tickets via API when credentials available

#### M20-T6: Auto-Sync Scheduler

**Scope:**
- `POST /sync/schedule` with `{source_name, interval_minutes}`. Default: 60 min when app open
- `GET /sync/status` returns last sync per source. Subtle sync indicator in sidebar

**Files:** `engine/compass/server.py`, `engine/compass/sync.py` (create), `app/src/components/layout/Sidebar.tsx`

**DoD:** Connected sources auto-refresh on schedule; user sees sync status

---

## M21: Non-Technical PM Onboarding

**Deps:** M17 complete

### Tasks

#### M21-T1: Project Templates

**Scope:**
- Templates: "B2B SaaS", "Consumer App", "Platform/API", "Marketplace", "Internal Tool"
- Each pre-configures: recommended sources, default chat mode, example questions, starter compass.yaml

**Files:** `engine/compass/templates/` (create dir + templates), `engine/compass/server.py`, `app/src/pages/WorkspacePage.tsx`

**DoD:** Create project from template with pre-configured sources

#### M21-T2: Git Repo Auto-Creation

**Scope:**
- New projects auto `git init` with `.gitignore` (exclude `.compass/knowledge/`, `*.enc`)
- Uses `gitpython` (already a dep). Initial commit with compass.yaml

**Files:** `engine/compass/server.py` (modify `/init`), `engine/compass/git_utils.py` (create)

**DoD:** New projects are git repos by default

#### M21-T3: Push to GitHub

**Deps:** M21-T2

**Scope:**
- If GitHub connected, "Push to GitHub" button. Creates repo via API, pushes
- PM enters repo name, clicks button — done

**Files:** `engine/compass/git_utils.py`, `engine/compass/server.py` (`POST /git/push`), `app/src/components/workspace/GitPush.tsx` (create)

**DoD:** One-click repo creation + push for connected GitHub users

#### M21-T4: Guided Onboarding V2

**Deps:** M21-T1

**Scope:**
- Step-by-step wizard: 1) Sign in or skip → 2) Choose template → 3) Connect sources (OAuth buttons) → 4) First ingest + discovery
- Progress indicator, contextual help, skip-able

**Files:** `app/src/pages/OnboardingPage.tsx` (rewrite), `app/src/components/onboarding/` (create dir + steps)

**DoD:** PM goes from zero to first discovery in under 5 minutes

---

## M22: Chart Engine & Evidence Visualization

**Library: Recharts** — React-native, composable, 140KB, great TS support, works with Tailwind.

### Tasks

#### M22-T1: Chart Component Library

**Scope:**
- Add `recharts` to app. Build: `BarChart`, `LineChart`, `PieChart`, `AreaChart`, `RadarChart`
- Dark theme styling matching compass tokens. Empty state handling

**Files:** `app/src/components/charts/` (create: `BarChart.tsx`, `LineChart.tsx`, `PieChart.tsx`, `RadarChart.tsx`, `ChartTheme.ts`)

**DoD:** Reusable chart components with consistent styling

#### M22-T2: Evidence Distribution Dashboard

**Deps:** M22-T1

**Scope:**
- Pie (by source type), bar (by connector), area (freshness timeline)
- Dashboard tab on EvidencePage. Data from existing `/evidence` endpoint

**Files:** `app/src/pages/EvidencePage.tsx`, `app/src/components/evidence/EvidenceDashboard.tsx` (create)

**DoD:** Visual breakdown of ingested evidence

#### M22-T3: Opportunity Confidence Charts

**Deps:** M22-T1

**Scope:**
- Radar chart (confidence × impact × evidence strength). Bar chart ranking
- List vs chart toggle on DiscoverPage

**Files:** `app/src/pages/DiscoverPage.tsx`, `app/src/components/discover/OpportunityChart.tsx` (create)

**DoD:** Discovery results with visual chart view

#### M22-T4: Conflict Severity Matrix

**Deps:** M22-T1

**Scope:**
- Matrix of conflicts by source pair (Code×Docs, Code×Data, etc.), color-coded severity

**Files:** `app/src/pages/ConflictsPage.tsx`, `app/src/components/conflicts/ConflictMatrix.tsx` (create)

**DoD:** Conflicts shown as visual heatmap

---

## M23: Analytics Dashboard

**Deps:** M22-T1

### Tasks

#### M23-T1: Dashboard Engine Component

**Scope:**
- `Dashboarder(KG, model, prompt_version)` — takes NL question, generates chart specs
- Output: `DashboardSpec` with `{title, charts: [{type, data, x_key, y_keys, title}]}`
- LLM extracts numeric data from evidence for charting

**Files:** `engine/compass/engine/dashboarder.py` (create), `engine/compass/models/dashboards.py` (create), `engine/compass/prompts/dashboard_v1.py` (create), `engine/compass/server.py`

**DoD:** Engine generates chart specs from evidence + NL query

#### M23-T2: Dashboard Page

**Deps:** M23-T1

**Scope:**
- New page: `/dashboard`. User asks question → engine returns chart spec → Recharts renders
- Pin charts to persistent dashboard. Saved in `.compass/dashboards.json`

**Files:** `app/src/pages/DashboardPage.tsx` (create), `app/src/stores/dashboard.ts` (create), `app/src/components/layout/Sidebar.tsx`

**DoD:** Generate and pin charts from NL queries

#### M23-T3: Enhanced CSV/Excel Import

**Scope:**
- Analytics connector: structure detection, auto-detect column types, time series vs categorical

**Files:** `engine/compass/connectors/analytics.py`

**DoD:** Analytics ingests CSV/Excel with typed column detection

---

## M24: Rich Text Editor

**Editor: Tiptap** (ProseMirror-based) — open-source, React 19 compatible, modular, markdown round-trip, Y.js collab ready.

### Tasks

#### M24-T1: Tiptap Editor Component

**Scope:**
- Deps: `@tiptap/react`, `@tiptap/starter-kit`, extensions (table, image, task-list, code-block)
- `DocumentEditor` with toolbar: headings, bold/italic, lists, tables, code, images, tasks
- Markdown import/export. Dark theme

**Files:** `app/src/components/editor/DocumentEditor.tsx` (create), `app/src/components/editor/EditorToolbar.tsx` (create)

**DoD:** Rich editor with toolbar and markdown round-tripping

#### M24-T2: Document Storage

**Scope:**
- `Document` model: `{id, title, type, content_json, content_markdown, created_at, updated_at, tags, evidence_ids}`
- Types: "brief", "prd", "update", "email", "strategy", "custom"
- Storage: `.compass/documents/` dir, one JSON per doc
- Endpoints: `POST /documents/save|list|get|delete`

**Files:** `engine/compass/models/documents.py`, `engine/compass/documents.py` (create), `engine/compass/server.py`

**DoD:** CRUD for documents

#### M24-T3: Documents Page

**Deps:** M24-T1, M24-T2

**Scope:**
- New page: `/documents`. List with type badges, last edited. Click to edit
- "New Document" with type selector

**Files:** `app/src/pages/DocumentsPage.tsx` (create), `app/src/stores/documents.ts` (create), Sidebar

**DoD:** Create, edit, manage documents from dedicated page

#### M24-T4: AI Document Generation

**Deps:** M24-T1

**Scope:**
- "Generate with AI" in editor uses existing Writer engine
- Works on selections: "Expand this section", "Add evidence for this claim"
- Maps Writer output to Tiptap JSON

**Files:** `app/src/components/editor/AIAssist.tsx` (create), `app/src/components/editor/DocumentEditor.tsx`

**DoD:** AI generates content inline in editor

---

## M25: Document Sharing & Export

**Deps:** M24 complete

### Tasks

#### M25-T1: Multi-Format Export

**Scope:**
- Markdown, HTML (styled), PDF (Electron `printToPDF`), DOCX (`docx` npm package)
- Export button in editor toolbar and document list

**Files:** `app/src/components/editor/ExportMenu.tsx` (create), `app/electron/main.ts`

**DoD:** 4 export formats

#### M25-T2: Link Sharing (Cloud)

**Scope:**
- Upload doc to Cloud → shareable URL
- Simple viewer page, optionally password-protected

**Files:** `cloud/compass_cloud/server.py`, `cloud/compass_cloud/documents.py` (create), `app/src/components/editor/ShareButton.tsx` (create)

**DoD:** Cloud users generate shareable links

#### M25-T3: Evidence Citation Insertion

**Scope:**
- "Insert Citation" command in editor → evidence search modal → styled inline citation

**Files:** `app/src/components/editor/CitationInsert.tsx` (create), `app/src/components/editor/extensions/citation.ts` (create)

**DoD:** Cite evidence inline in documents

---

## M26: Slide Builder

### Tasks

#### M26-T1: Presentation Engine Component

**Scope:**
- `Presenter(KG, model, prompt_version)` — topic + evidence IDs → structured deck
- `Presentation` model: `{title, slides: [{title, layout, content_blocks: [{type, content}]}]}`
- Block types: heading, text, bullet_list, quote, chart_spec, image_placeholder, evidence_citation
- Layouts: title, content, two-column, image-left, chart, quote

**Files:** `engine/compass/engine/presenter.py` (create), `engine/compass/models/presentations.py` (create), `engine/compass/prompts/present_v1.py` (create), `engine/compass/server.py`

**DoD:** Engine generates structured slide deck from evidence

#### M26-T2: Slide Renderer

**Deps:** M26-T1

**Scope:**
- React component rendering `Presentation` as navigable slide deck
- Full-viewport cards, keyboard nav, progress indicator, dark theme

**Files:** `app/src/components/slides/SlideRenderer.tsx` (create), `app/src/components/slides/SlideLayouts.tsx` (create), `app/src/components/slides/SlideNavigation.tsx` (create)

**DoD:** Presentations render as navigable decks

#### M26-T3: Presentations Page

**Deps:** M26-T2

**Scope:**
- `/presentations`. Create (enter topic, select evidence), list saved, edit (reorder/add/remove slides), present mode (fullscreen)

**Files:** `app/src/pages/PresentationsPage.tsx` (create), `app/src/stores/presentations.ts` (create), Sidebar

**DoD:** Create, edit, save, and present slide decks

#### M26-T4: Slide Export

**Deps:** M26-T2

**Scope:**
- HTML (self-contained, reveal.js-style), PDF (one page per slide)

**Files:** `app/src/components/slides/SlideExport.tsx` (create), `app/electron/main.ts`

**DoD:** Export as HTML and PDF

---

## M27: Presentation Intelligence

**Deps:** M26 complete + M22-T1

### Tasks

#### M27-T1: Audience Adaptation

**Scope:**
- Select audience: Engineering, Leadership, Board, Customer, Cross-functional
- Adjusts tone, detail, emphasis per audience type

**Files:** `engine/compass/engine/presenter.py`, `engine/compass/prompts/present_v1.py`

**DoD:** Presentations adapt to audience

#### M27-T2: Speaker Notes

**Scope:**
- Auto-generated per slide: talking points, anticipated questions, evidence refs
- Bottom panel in present mode

**Files:** `engine/compass/engine/presenter.py`, `app/src/components/slides/PresenterView.tsx` (create)

**DoD:** Slides have speaker notes in presenter view

#### M27-T3: Chart Embedding

**Scope:**
- Slides with chart blocks (reuse M22 components). Presenter generates chart specs from evidence

**Files:** `app/src/components/slides/SlideLayouts.tsx`, `engine/compass/engine/presenter.py`

**DoD:** Slides contain rendered charts

---

## M28: Landing Page / UI Prototype Generator

**Approach:** LLM generates self-contained HTML + Tailwind CDN. Rendered in sandboxed iframe. No build tooling.

### Tasks

#### M28-T1: Prototype Engine Component

**Scope:**
- `Prototyper(KG, model, prompt_version)` — description + evidence → HTML
- Types: landing-page, dashboard, form, pricing-page, onboarding-flow
- Output: `Prototype` with `{title, type, html, description, iterations: [{prompt, html}]}`

**Files:** `engine/compass/engine/prototyper.py` (create), `engine/compass/models/prototypes.py` (create), `engine/compass/prompts/prototype_v1.py` (create), `engine/compass/server.py`

**DoD:** Engine generates self-contained HTML prototypes

#### M28-T2: Prototype Preview

**Deps:** M28-T1

**Scope:**
- Sandboxed iframe. Split view: preview left, controls right
- Responsive toggles: desktop/tablet/mobile. "Iterate" button for LLM revisions. Version history

**Files:** `app/src/components/prototype/PrototypePreview.tsx` (create), `app/src/components/prototype/IterationPanel.tsx` (create), `app/src/components/prototype/ViewportToggle.tsx` (create)

**DoD:** Prototypes render with responsive preview and iteration

#### M28-T3: Prototypes Page

**Deps:** M28-T2

**Scope:**
- `/prototypes`. New + type selector, gallery of saved prototypes, click to preview

**Files:** `app/src/pages/PrototypesPage.tsx` (create), `app/src/stores/prototypes.ts` (create), Sidebar

**DoD:** Create, iterate, save, browse prototypes

#### M28-T4: Prototype Export

**Deps:** M28-T2

**Scope:**
- HTML file (self-contained), PNG screenshot (Electron `capturePage`), hosted URL (Cloud)

**Files:** `app/src/components/prototype/PrototypeExport.tsx` (create), `app/electron/main.ts`

**DoD:** Export as HTML, PNG, hosted URL

---

## M29: Prototype Intelligence

**Deps:** M28 complete

### Tasks

#### M29-T1: Evidence-Driven Content

**Scope:**
- Prototyper queries KG: real product names, metrics, user quotes populate the prototype

**Files:** `engine/compass/engine/prototyper.py`

**DoD:** Prototypes use realistic content from evidence

#### M29-T2: Component Library

**Scope:**
- Pre-built HTML snippets: hero, feature grid, pricing, testimonials, signup, dashboard
- Reference by name in descriptions or browse library

**Files:** `engine/compass/prototype_components/` (create dir + HTML), `app/src/components/prototype/ComponentLibrary.tsx` (create)

**DoD:** Compose prototypes from pre-built components

#### M29-T3: A/B Variant Generation

**Scope:**
- "Generate Variants" creates 2-3 alternatives. Side-by-side comparison view

**Files:** `engine/compass/engine/prototyper.py`, `app/src/components/prototype/VariantComparison.tsx` (create)

**DoD:** Generate and compare variant prototypes

---

## M30: Team Collaboration

**Deps:** M17-M29 complete

### Tasks

#### M30-T1: Workspace Sharing

**Scope:**
- Share workspace with team via Cloud. Invite by email, read/write access. Sync via Cloud hub

**Files:** `cloud/compass_cloud/teams.py`, `cloud/compass_cloud/server.py`, `app/src/components/workspace/ShareWorkspace.tsx` (create)

**DoD:** Workspaces shareable with team members

#### M30-T2: Unified Export Hub

**Scope:**
- Single "Export" in command palette for any content type. Format selector. Batch "Export All" → ZIP

**Files:** `app/src/components/export/ExportHub.tsx` (create), `app/electron/main.ts`

**DoD:** Unified export for all content types

#### M30-T3: Activity Feed

**Scope:**
- Workspace activity: evidence ingested, docs created, discoveries run, presentations built

**Files:** `engine/compass/activity.py` (create), `engine/compass/server.py`, `app/src/components/workspace/ActivityFeed.tsx` (create)

**DoD:** Activity feed shows workspace history

#### M30-T4: Notification System

**Scope:**
- In-app + desktop notifications: sync complete, new conflicts, shared doc updated, team joined
- Bell in sidebar. Electron `Notification` API

**Files:** `app/src/stores/notifications.ts` (create), `app/src/components/layout/NotificationBell.tsx` (create), `app/electron/main.ts`

**DoD:** Users receive notifications for key events

---

## New Dependencies (M17-M30)

**Engine (pyproject.toml):**
- `openpyxl>=3.1.0` (Excel parsing, M23)

**App (package.json):**
- `recharts ^2.12.0` (M22)
- `@tiptap/react ^2.6.0`, `@tiptap/starter-kit ^2.6.0`, `@tiptap/extension-table ^2.6.0`, `@tiptap/extension-image ^2.6.0`, `@tiptap/extension-task-list ^2.6.0`, `@tiptap/extension-code-block-lowlight ^2.6.0` (M24)
- `docx ^8.5.0` (M25)
- `jszip ^3.10.0` (M30)

## M17-M30 Summary

| Milestone | Tasks | Theme |
|-----------|-------|-------|
| M17 | 5 | Auth Infrastructure |
| M18 | 3 | Social Auth |
| M19 | 4 | Live Connectors (GitHub, Jira) |
| M20 | 6 | All Live Connectors |
| M21 | 4 | PM Onboarding |
| M22 | 4 | Chart Engine |
| M23 | 3 | Analytics Dashboard |
| M24 | 4 | Document Editor |
| M25 | 3 | Document Sharing |
| M26 | 4 | Slide Builder |
| M27 | 3 | Slide Intelligence |
| M28 | 4 | Prototype Builder |
| M29 | 3 | Prototype Intelligence |
| M30 | 4 | Collaboration |
| **Total** | **54 tasks** | **14 milestones** |
