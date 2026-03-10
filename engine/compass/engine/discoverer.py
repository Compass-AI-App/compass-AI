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

## Confidence levels (strict rules)

- HIGH confidence: 3+ different source types corroborate this opportunity. Example: users
  request it (Judgment), usage data shows the gap (Data), and the codebase confirms the
  feature is missing or broken (Code).
- MEDIUM confidence: 2 source types agree. Example: multiple interview subjects request
  a feature (Judgment) and the roadmap doesn't include it (Docs).
- LOW confidence: Single source signal. Example: one support ticket mentions a pain point
  but no other source corroborates it.

## Key principles

1. Every opportunity MUST cite specific evidence items by their exact title
2. Rank by multi-source corroboration first, then by potential impact
3. Opportunities that resolve detected conflicts should rank higher
4. Be specific — "improve sync reliability" is better than "improve product quality"
5. Never recommend something the evidence doesn't support"""

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

## Few-shot example

Example of a well-grounded opportunity:
{{
  "title": "Fix sync reliability",
  "description": "The sync module is the #1 source of user pain. Support data shows 23 tickets about sync failures in the last month. Three of five interviewed customers cited sync unreliability as their top frustration. Meanwhile, the codebase shows the sync module hasn't been updated in 6 months despite the strategy doc listing it as a Q1 priority. This is a clear case where investment doesn't match stated priorities.",
  "confidence": "high",
  "evidence_summary": "Support tickets (23 sync-related), Interview: Alice ('sync crashes daily'), Interview: Bob ('sync is unusable on large files'), Analytics: feature_usage (sync retention at 45%), Source: src/sync/engine.py (last modified 6 months ago)",
  "estimated_impact": "Resolving sync reliability could recover the 15% MoM decline in sync feature adoption and reduce support ticket volume by ~40%",
  "cited_evidence_titles": ["Support tickets: tickets (23 tickets)", "Interview: Customer Interview: Alice", "Interview: Customer Interview: Bob", "Analytics: feature_usage", "Source: src/sync/engine.py"],
  "related_conflict_titles": ["Strategic priority abandoned in code"]
}}

## Instructions

Synthesize this evidence into a ranked list of product opportunities. For each:
1. Ground it in specific evidence — cite exact titles from the evidence above
2. Explain WHY this matters, connecting evidence across source types
3. Rate confidence strictly: HIGH (3+ source types), MEDIUM (2 source types), LOW (1 source type)
4. Estimate impact in plain language with specifics where possible

Respond as JSON:
{{
  "opportunities": [
    {{
      "title": "Brief, specific opportunity title",
      "description": "What to build and why, with evidence citations inline",
      "confidence": "high|medium|low",
      "evidence_summary": "Key evidence items supporting this, citing exact titles",
      "estimated_impact": "Specific, measurable impact estimate where possible",
      "cited_evidence_titles": ["exact title of evidence item 1", "exact title 2"],
      "related_conflict_titles": ["exact title of related conflict, if any"]
    }}
  ]
}}

Return 3-7 opportunities, ranked by confidence then impact. Every opportunity must
cite at least one specific evidence title. Do not invent evidence that isn't listed above."""


def _format_evidence_list(items: list[Evidence], max_items: int = 20) -> str:
    if not items:
        return "(no evidence from this source)"
    from datetime import datetime, timedelta

    lines = []
    for item in items[:max_items]:
        preview = item.content[:300] + "..." if len(item.content) > 300 else item.content
        freshness = ""
        if hasattr(item, "ingested_at") and item.ingested_at:
            age = datetime.now() - item.ingested_at
            if age > timedelta(days=7):
                freshness = f" ⚠️ STALE ({age.days} days old)"
        lines.append(f"- **{item.title}**{freshness}: {preview}")
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

        # Build lookup maps for conflict_ids and evidence_ids resolution
        conflict_title_to_idx = {}
        for i, c in enumerate(conflict_report.conflicts):
            conflict_title_to_idx[c.title.lower()] = str(i)

        evidence_title_to_id = {}
        for e in self.kg.store.items:
            evidence_title_to_id[e.title.lower()] = e.id

        opportunities = []
        for i, opp in enumerate(result.get("opportunities", []), 1):
            # Resolve cited_evidence_titles → evidence_ids
            evidence_ids = []
            for cited_title in opp.get("cited_evidence_titles", []):
                cited_lower = cited_title.lower()
                # Exact match first
                if cited_lower in evidence_title_to_id:
                    evidence_ids.append(evidence_title_to_id[cited_lower])
                else:
                    # Partial match — find evidence whose title contains the cited text
                    for etitle, eid in evidence_title_to_id.items():
                        if cited_lower in etitle or etitle in cited_lower:
                            evidence_ids.append(eid)
                            break

            # Resolve related_conflict_titles → conflict_ids
            conflict_ids = []
            for conflict_title in opp.get("related_conflict_titles", []):
                ct_lower = conflict_title.lower()
                if ct_lower in conflict_title_to_idx:
                    conflict_ids.append(conflict_title_to_idx[ct_lower])
                else:
                    for ctitle, cidx in conflict_title_to_idx.items():
                        if ct_lower in ctitle or ctitle in ct_lower:
                            conflict_ids.append(cidx)
                            break

            opportunities.append(Opportunity(
                rank=i,
                title=opp["title"],
                description=opp["description"],
                confidence=Confidence(opp.get("confidence", "medium")),
                evidence_summary=opp.get("evidence_summary", ""),
                estimated_impact=opp.get("estimated_impact", ""),
                evidence_ids=evidence_ids,
                conflict_ids=conflict_ids,
            ))

        return opportunities
