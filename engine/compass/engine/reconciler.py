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


RECONCILE_SYSTEM = """You are Compass, a product discovery engine. Your job is to find
conflicts between different sources of product truth.

The four sources of truth are:
- CODE: What the product CAN do (technical reality)
- DOCS: What the product is EXPECTED to do (strategy, specs)
- DATA: What IS happening (metrics, usage)
- JUDGMENT: What SHOULD happen (user feedback, interviews, support)

When these sources disagree, that's where product opportunities hide."""

RECONCILE_PROMPT = """Analyze the following evidence from two different sources of truth and identify conflicts.

SOURCE A ({source_a}): {source_a_desc}
{evidence_a}

SOURCE B ({source_b}): {source_b_desc}
{evidence_b}

Find conflicts where these sources tell different stories. For each conflict:
- Explain what each source says
- Rate severity: "high" (clear contradiction with business impact), "medium" (notable gap), "low" (minor inconsistency)
- Recommend an action

Respond as JSON:
{{
  "conflicts": [
    {{
      "title": "Brief conflict title",
      "description": "What source A says vs what source B says",
      "severity": "high|medium|low",
      "source_a_evidence": ["titles of relevant evidence from source A"],
      "source_b_evidence": ["titles of relevant evidence from source B"],
      "recommendation": "What the PM should investigate or do"
    }}
  ]
}}

If no real conflicts exist, return {{"conflicts": []}}. Only flag genuine disagreements, not trivial differences."""


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
                        ))
                except Exception as e:
                    console.print(f"[dim]Warning: Could not reconcile {source_a.value} vs {source_b.value}: {e}[/dim]")

                progress.advance(task)

        all_conflicts.sort(
            key=lambda c: {"high": 0, "medium": 1, "low": 2}[c.severity.value]
        )
        return ConflictReport(conflicts=all_conflicts)
