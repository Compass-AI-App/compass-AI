"""Product Discovery Engine — synthesize evidence into opportunities.

This answers the question: "What should we build next?"
"""

from __future__ import annotations

from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn

from compass.engine.knowledge_graph import KnowledgeGraph
from compass.engine.llm import ask_json
from compass.models.sources import Evidence, SourceType
from compass.models.conflicts import ConflictReport
from compass.models.specs import Opportunity, Confidence


DISCOVER_SYSTEM = """You are Compass, a product discovery engine. Your job is to synthesize
evidence from multiple sources into actionable product opportunities.

You have access to:
- Evidence from four sources of truth (Code, Docs, Data, Judgment)
- Conflicts between those sources (where they disagree)

Your recommendations must be grounded in evidence, not opinion. Every opportunity
should cite specific evidence items. Rank by signal strength, not assumption."""

DISCOVER_PROMPT = """Based on all available product evidence and detected conflicts, identify
the top product opportunities — things the team should consider building or fixing.

## Evidence Summary

### Code (Technical Reality)
{code_evidence}

### Docs (Strategy & Specs)
{docs_evidence}

### Data (Usage & Metrics)
{data_evidence}

### Judgment (User Feedback & Interviews)
{judgment_evidence}

## Detected Conflicts
{conflicts}

## Instructions

Synthesize this evidence into a ranked list of product opportunities. For each:
1. Ground it in specific evidence (cite titles)
2. Explain WHY this matters (connecting evidence across sources)
3. Rate confidence: "high" (strong multi-source signal), "medium" (notable signal), "low" (weak/single-source)
4. Estimate impact in plain language

Respond as JSON:
{{
  "opportunities": [
    {{
      "title": "Brief opportunity title",
      "description": "What to build and why, grounded in evidence",
      "confidence": "high|medium|low",
      "evidence_summary": "Key evidence supporting this (cite specific items)",
      "estimated_impact": "Plain-language impact estimate",
      "related_conflicts": ["titles of related conflicts, if any"]
    }}
  ]
}}

Return 3-7 opportunities, ranked by confidence and potential impact. Prioritize
opportunities supported by multiple source types over single-source signals."""


def _format_evidence_list(items: list[Evidence], max_items: int = 20) -> str:
    if not items:
        return "(no evidence from this source)"
    lines = []
    for item in items[:max_items]:
        preview = item.content[:300] + "..." if len(item.content) > 300 else item.content
        lines.append(f"- **{item.title}**: {preview}")
    return "\n".join(lines)


def _format_conflicts(report: ConflictReport) -> str:
    if not report.conflicts:
        return "(no conflicts detected)"
    lines = []
    for c in report.conflicts:
        lines.append(
            f"- [{c.severity.value.upper()}] **{c.title}** ({c.conflict_type.description}): "
            f"{c.description}"
        )
    return "\n".join(lines)


class Discoverer:
    """Synthesizes evidence and conflicts into product opportunities."""

    def __init__(self, kg: KnowledgeGraph, model: str = "claude-sonnet-4-20250514"):
        self.kg = kg
        self.model = model

    def discover(self, conflict_report: ConflictReport | None = None) -> list[Opportunity]:
        """Analyze all evidence and conflicts to surface opportunities."""
        console = Console()

        if not self.kg.store.items:
            console.print("[yellow]No evidence ingested. Run 'compass ingest' first.[/yellow]")
            return []

        conflict_report = conflict_report or ConflictReport()

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            task = progress.add_task("Discovering opportunities...", total=1)

            prompt = DISCOVER_PROMPT.format(
                code_evidence=_format_evidence_list(self.kg.store.by_source(SourceType.CODE)),
                docs_evidence=_format_evidence_list(self.kg.store.by_source(SourceType.DOCS)),
                data_evidence=_format_evidence_list(self.kg.store.by_source(SourceType.DATA)),
                judgment_evidence=_format_evidence_list(self.kg.store.by_source(SourceType.JUDGMENT)),
                conflicts=_format_conflicts(conflict_report),
            )

            try:
                result = ask_json(prompt, system=DISCOVER_SYSTEM, model=self.model)
            except Exception as e:
                console.print(f"[red]Discovery failed: {e}[/red]")
                return []

            progress.advance(task)

        opportunities = []
        for i, opp in enumerate(result.get("opportunities", []), 1):
            opportunities.append(Opportunity(
                rank=i,
                title=opp["title"],
                description=opp["description"],
                confidence=Confidence(opp.get("confidence", "medium")),
                evidence_summary=opp.get("evidence_summary", ""),
                estimated_impact=opp.get("estimated_impact", ""),
            ))

        return opportunities
