# Compass MVP: The Minimum Demo

## What the Demo Shows

A PM connects their product's evidence sources, asks "what should we build next?", and gets an evidence-grounded feature recommendation with a spec that a coding agent can execute.

## The Flow

```
compass init "My Product"
  → Creates .compass/ workspace with product config

compass connect github --repo owner/repo
compass connect docs --folder "Product Strategy"
compass connect analytics --file usage_data.csv
compass connect interviews --folder ./interviews/
compass connect support --file support_tickets.csv
  → Registers evidence sources

compass ingest
  → Pulls data from all connected sources
  → Indexes into the product knowledge graph
  → Shows: "Ingested 847 evidence items from 5 sources"

compass reconcile
  → Analyzes across the four sources of truth
  → Surfaces conflicts:
    "CONFLICT: Strategy doc claims 'real-time sync' is a priority,
     but codebase shows the sync module hasn't been touched in 8 months.
     Meanwhile, 23 support tickets mention sync failures."

compass discover
  → Synthesizes all evidence into ranked opportunities:
    "1. Fix sync reliability (HIGH confidence)
        Evidence: 23 support tickets, 3 interview mentions, declining usage data
        Conflict: Strategy says priority but code is stale
     2. Add batch export (MEDIUM confidence)
        Evidence: 8 interview requests, competitor has it
     3. Simplify onboarding (MEDIUM confidence)
        Evidence: 40% drop-off in first session, 5 support tickets"

compass specify "Fix sync reliability"
  → Generates a full feature spec:
    - Problem statement (with evidence citations)
    - Proposed solution
    - Data model changes
    - Task breakdown (agent-ready)
    - Success metrics
```

## Input: What the PM Provides

For the MVP, sources can be:
- **Code:** A GitHub repo URL (or local path)
- **Docs:** A folder of markdown/text strategy documents
- **Data:** A CSV of usage metrics or analytics export
- **Interviews:** A folder of interview transcripts (text/markdown)
- **Support:** A CSV of support tickets

The MVP uses local files and GitHub. Google Docs and live analytics come in v2.

## Output: What the PM Gets

1. **Conflict report** — Markdown showing where sources disagree
2. **Opportunity ranking** — Evidence-grounded list of what to build
3. **Feature spec** — Full specification with:
   - Problem statement with evidence citations
   - Proposed approach
   - Task breakdown formatted for coding agents (Cursor, Claude Code)
   - Success criteria

All output is markdown, written to the `.compass/output/` directory.

## What "Agent-Ready" Means

The spec output includes a section formatted specifically for coding agents:

```markdown
## Agent Tasks

### Task 1: Fix sync retry logic
**Context:** The sync module at `src/sync/` has no retry mechanism.
Support tickets #142, #156, #178 report intermittent sync failures.
**Acceptance criteria:** Sync retries up to 3 times with exponential backoff.
**Files to modify:** src/sync/client.py, src/sync/config.py
**Tests:** Add retry tests to tests/sync/test_client.py

### Task 2: Add sync health monitoring
...
```

This format is designed to be copy-pasted into Cursor or Claude Code as a prompt.
