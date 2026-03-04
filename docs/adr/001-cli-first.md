# ADR-001: CLI Agent First

**Status:** Accepted
**Date:** 2026-03-04

## Context

Compass needs an interface. Three options were evaluated:

| Option | Time to MVP | Audience Reach | Engineering Cost |
|--------|-------------|----------------|------------------|
| CLI Agent | 2-4 weeks | Technical PMs, founders | Low |
| Web Application | 3-6 months | All PMs | High |
| Cursor Extension | 4-6 weeks | Cursor users only | Medium |

## Decision

**CLI agent first, web app later.**

Build Compass as a Python CLI tool (like Claude Code for PMs) that runs against a product workspace. Graduate to a web application once the workflow is validated.

## Rationale

1. **Speed to demo.** A CLI can be built in weeks, not months. For YC and early validation, speed matters more than polish.
2. **Workflow before interface.** The hard problem is the product discovery loop, not the UI. A CLI forces us to get the workflow right before investing in interface.
3. **The audience that matters first.** Early adopters of a "Cursor for PMs" tool are technical PMs and founders — people comfortable in a terminal. Non-technical PMs come later with the web app.
4. **Architecture portability.** The core engine (knowledge graph, reconciliation, discovery) is interface-agnostic. Building it as a library with a CLI frontend means the web app reuses everything.

## Tech Stack

- **Language:** Python 3.11+
- **CLI:** Typer + Rich (beautiful terminal output)
- **Data models:** Pydantic v2
- **Vector store:** ChromaDB (local-first, no infrastructure)
- **LLM:** Anthropic Claude API (reasoning engine)
- **HTTP:** httpx (async connectors)
- **Config:** YAML + environment variables

## Consequences

- PMs who can't use a terminal won't be able to use Compass v1. This is acceptable — they're not the early adopter segment.
- The web app (v2) will wrap the same core engine with a browser-based interface.
- All core logic must be cleanly separated from the CLI layer to enable this transition.
