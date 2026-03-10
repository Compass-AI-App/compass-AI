"""Reconciliation Engine — surface conflicts across the four sources of truth.

This is Compass's core differentiator. Most PM tools help you write docs.
Compass helps you find where your sources of truth disagree.
"""

from __future__ import annotations

from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn

from compass.engine.knowledge_graph import KnowledgeGraph
from compass.engine.llm import ask_json
from compass.models.sources import SourceType, Evidence
from compass.models.conflicts import Conflict, ConflictReport, ConflictType, ConflictSeverity


RECONCILE_SYSTEM = """You are Compass, a product discovery engine that finds meaningful
conflicts between different sources of product truth.

The four sources of truth are:
- CODE: What the product CAN do (technical reality — codebase, APIs, architecture)
- DOCS: What the product is EXPECTED to do (strategy, specs, roadmaps)
- DATA: What IS happening (metrics, usage patterns, analytics)
- JUDGMENT: What SHOULD happen (user feedback, interviews, support tickets)

## What constitutes a REAL conflict

A real conflict is when two sources tell fundamentally different stories about the
product in a way that has business consequences. Examples:

REAL CONFLICT (HIGH): Strategy doc says "real-time sync is P0 for Q1" but the sync
module hasn't been touched in 8 months, has 23 open support tickets about failures,
and usage data shows sync feature adoption declining 15% MoM. Three sources contradict
the strategy.

REAL CONFLICT (MEDIUM): User interviews show 5 of 8 customers requesting batch export,
but the roadmap doesn't mention it and analytics show the existing export feature has
low usage. The signal is real but could have multiple explanations.

NOT A CONFLICT: Strategy doc says "mobile-first" while codebase uses the term
"responsive design." This is a terminology difference, not a substantive disagreement.

NOT A CONFLICT: Two evidence items describe the same thing using different levels of
detail. Redundancy is not conflict.

## Key principles

1. Every conflict MUST be actionable — if you can't recommend a concrete next step, don't flag it
2. Cite specific evidence by title — never make vague references
3. Higher signal_strength = more independent evidence items corroborating the conflict
4. Prefer fewer high-quality conflicts over many trivial ones"""

RECONCILE_PROMPT = """Analyze the following evidence from two sources of truth and identify
genuine conflicts where they tell contradictory stories.

SOURCE A ({source_a}): {source_a_desc}
{evidence_a}

SOURCE B ({source_b}): {source_b_desc}
{evidence_b}

## Few-shot examples

Example 1 — HIGH severity conflict:
{{
  "title": "Strategic priority abandoned in code",
  "description": "DOCS claims 'real-time sync is our top priority for Q1' (Product Strategy doc), but CODE shows the sync module (src/sync/) has zero commits in the last 6 months. The most recent changes are all in the reporting module.",
  "severity": "high",
  "signal_strength": 4,
  "source_a_evidence": ["Product Strategy", "Q1 Roadmap"],
  "source_b_evidence": ["Recent commits: my-product", "Source: src/sync/engine.py"],
  "recommendation": "Investigate whether sync is truly the priority. If yes, engineering investment doesn't match. If priorities shifted, update the strategy doc to reflect reality."
}}

Example 2 — MEDIUM severity conflict:
{{
  "title": "Users want feature not on roadmap",
  "description": "JUDGMENT shows 3 of 5 interviewed customers asking for a Slack integration, but DOCS roadmap has no mention of integrations in the next two quarters.",
  "severity": "medium",
  "signal_strength": 3,
  "source_a_evidence": ["Interview: Customer A", "Interview: Customer C", "Interview: Customer E"],
  "source_b_evidence": ["Product Roadmap"],
  "recommendation": "Validate Slack integration demand with usage data. If confirmed by multiple sources, consider adding to roadmap."
}}

Example 3 — Should NOT be flagged (don't include this type):
The strategy doc uses the term "mobile-first" while the codebase has a folder called
"responsive-ui". This is terminology variation, not a real conflict. Skip it.

## Instructions

Find conflicts where these two sources genuinely disagree. For each conflict:
- Explain specifically what each source says, citing evidence titles
- Rate severity: "high" (clear contradiction with business impact), "medium" (notable gap worth investigating), "low" (minor misalignment)
- Count signal_strength: how many independent evidence items support this conflict
- Recommend a concrete action the PM should take

Respond as JSON:
{{
  "conflicts": [
    {{
      "title": "Brief, specific conflict title",
      "description": "What source A says vs what source B says, citing specific evidence",
      "severity": "high|medium|low",
      "signal_strength": 3,
      "source_a_evidence": ["exact titles of relevant evidence from source A"],
      "source_b_evidence": ["exact titles of relevant evidence from source B"],
      "recommendation": "Concrete next step the PM should take"
    }}
  ]
}}

If no real conflicts exist between these sources, return {{"conflicts": []}}.
Do NOT flag: terminology differences, redundant descriptions, different detail levels,
or anything without a concrete actionable recommendation."""


def _format_evidence(items: list[Evidence], max_items: int = 15) -> str:
    """Format evidence items for the LLM prompt."""
    lines = []
    for item in items[:max_items]:
        content_preview = item.content[:500] + "..." if len(item.content) > 500 else item.content
        lines.append(f"- [{item.title}]: {content_preview}")
    return "\n".join(lines) if lines else "(no evidence from this source)"


SOURCE_PAIRS: list[tuple[SourceType, SourceType, ConflictType]] = [
    (SourceType.CODE, SourceType.DOCS, ConflictType.CODE_VS_DOCS),
    (SourceType.CODE, SourceType.DATA, ConflictType.CODE_VS_DATA),
    (SourceType.CODE, SourceType.JUDGMENT, ConflictType.CODE_VS_JUDGMENT),
    (SourceType.DOCS, SourceType.DATA, ConflictType.DOCS_VS_DATA),
    (SourceType.DOCS, SourceType.JUDGMENT, ConflictType.DOCS_VS_JUDGMENT),
    (SourceType.DATA, SourceType.JUDGMENT, ConflictType.DATA_VS_JUDGMENT),
]


class Reconciler:
    """Finds conflicts between sources of truth."""

    def __init__(self, kg: KnowledgeGraph, model: str = "claude-sonnet-4-20250514"):
        self.kg = kg
        self.model = model

    def reconcile(self) -> ConflictReport:
        """Analyze all source pairs for conflicts."""
        console = Console()
        all_conflicts: list[Conflict] = []

        available_sources = set()
        for item in self.kg.store.items:
            available_sources.add(item.source_type)

        pairs_to_check = [
            (sa, sb, ct) for sa, sb, ct in SOURCE_PAIRS
            if sa in available_sources and sb in available_sources
        ]

        if not pairs_to_check:
            console.print("[yellow]Need evidence from at least 2 source types to reconcile.[/yellow]")
            return ConflictReport()

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            task = progress.add_task("Reconciling sources...", total=len(pairs_to_check))

            for source_a, source_b, conflict_type in pairs_to_check:
                progress.update(
                    task,
                    description=f"Comparing {source_a.value} vs {source_b.value}...",
                )

                evidence_a = self.kg.store.by_source(source_a)
                evidence_b = self.kg.store.by_source(source_b)

                if not evidence_a or not evidence_b:
                    progress.advance(task)
                    continue

                prompt = RECONCILE_PROMPT.format(
                    source_a=source_a.value.upper(),
                    source_a_desc=source_a.description,
                    evidence_a=_format_evidence(evidence_a),
                    source_b=source_b.value.upper(),
                    source_b_desc=source_b.description,
                    evidence_b=_format_evidence(evidence_b),
                )

                try:
                    result = ask_json(prompt, system=RECONCILE_SYSTEM, model=self.model)
                    for c in result.get("conflicts", []):
                        all_conflicts.append(Conflict(
                            conflict_type=conflict_type,
                            severity=ConflictSeverity(c.get("severity", "medium")),
                            title=c["title"],
                            description=c["description"],
                            source_a_evidence=c.get("source_a_evidence", []),
                            source_b_evidence=c.get("source_b_evidence", []),
                            recommendation=c.get("recommendation", ""),
                            signal_strength=c.get("signal_strength", 1),
                        ))
                except Exception as e:
                    console.print(f"[dim]Warning: Could not reconcile {source_a.value} vs {source_b.value}: {e}[/dim]")

                progress.advance(task)

        all_conflicts.sort(
            key=lambda c: {"high": 0, "medium": 1, "low": 2}[c.severity.value]
        )
        return ConflictReport(conflicts=all_conflicts)
