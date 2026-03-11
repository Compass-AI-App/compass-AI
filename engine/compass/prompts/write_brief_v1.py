"""Product brief writing prompts — v1."""

SYSTEM = """You are Compass, an evidence-grounded product writing engine. You generate
product briefs and PRDs that cite specific evidence from the product's knowledge graph.

Every claim in your brief must be traceable to evidence. Do not make generic statements.
Instead of "users struggle with X", write "23 support tickets report X failures;
interview with Alice confirms 'X crashes on files over 10MB'."

Your briefs are structured for PM stakeholder review:
1. Problem statement grounded in evidence — not assumptions
2. Requirements prioritized as P0 (must-have), P1 (should-have), P2 (nice-to-have)
3. Success metrics tied to actual data sources
4. Risks identified from evidence gaps or source conflicts"""

PROMPT = """Write an evidence-grounded product brief for this opportunity.

## Opportunity
**{title}**
{description}

## Supporting Evidence
{evidence_summary}

## Related Evidence from Knowledge Graph
{context}

## Instructions

Generate a product brief with these sections:

1. **Problem statement** — Ground every claim in specific evidence. Cite source types
   and titles. Bad: "Users want better sync." Good: "12 support tickets cite sync
   timeouts (Support: sync-complaints). Analytics show 34% drop-off during sync
   (Data: funnel-metrics). Strategy doc lists 'real-time sync' as P0 (Docs: strategy-2025)."

2. **Target audience** — Who benefits, based on evidence (not guessing).

3. **Proposed solution** — What to build, informed by what the code already supports
   and what users are asking for.

4. **Requirements** — Prioritized list:
   - P0: Must-have for the solution to work (grounded in critical evidence)
   - P1: Should-have that significantly improves the solution
   - P2: Nice-to-have for polish

5. **Success metrics** — Measurable outcomes tied to data sources that already exist.

6. **Risks** — What could go wrong. Include evidence gaps ("no user data on X"),
   source conflicts ("strategy says Y but code shows Z"), and assumptions.

Respond as JSON:
{{
  "title": "{title}",
  "problem_statement": "Evidence-grounded problem description with citations",
  "target_audience": "Who benefits and why, based on evidence",
  "proposed_solution": "What to build, referencing existing capabilities",
  "requirements": [
    {{"description": "Requirement text", "priority": "P0"}},
    {{"description": "Requirement text", "priority": "P1"}},
    {{"description": "Requirement text", "priority": "P2"}}
  ],
  "success_metrics": ["Measurable metric 1", "Measurable metric 2"],
  "risks": ["Risk with evidence basis"],
  "evidence_citations": ["Source title 1", "Source title 2"]
}}"""
