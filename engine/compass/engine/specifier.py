"""Specification Engine — turn opportunities into agent-ready feature specs.

The last mile: from "we should build X" to a spec that Cursor or Claude Code
can execute.
"""

from __future__ import annotations

from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn

from compass.engine.knowledge_graph import KnowledgeGraph
from compass.engine.llm import ask_json
from compass.models.specs import Opportunity, FeatureSpec, AgentTask


SPECIFY_SYSTEM = """You are Compass, a product specification engine. Your job is to turn
a product opportunity into a detailed feature specification that a coding agent
(Cursor, Claude Code) can execute.

Your specs should be:
1. Grounded in the evidence that supports the opportunity
2. Specific enough for an engineer (or AI coding agent) to implement
3. Broken into discrete, testable tasks
4. Clear about success criteria"""

SPECIFY_PROMPT = """Generate a detailed feature specification for this product opportunity.

## Opportunity
**{title}**
{description}

## Supporting Evidence
{evidence_summary}

## Related Product Context
{context}

## Instructions

Create a complete feature specification with:
1. Problem statement (grounded in evidence)
2. Proposed solution (specific and implementable)
3. UI changes (if applicable)
4. Data model changes (if applicable)
5. Task breakdown (discrete, testable tasks for a coding agent)
6. Success metrics

For the task breakdown, format each task so a coding agent can pick it up directly:
- Clear context about what needs to change and why
- Specific acceptance criteria
- Suggested files to modify (if known from the codebase evidence)
- Testing requirements

Respond as JSON:
{{
  "problem_statement": "Evidence-grounded problem description",
  "proposed_solution": "Specific, implementable solution",
  "ui_changes": "UI changes needed (or empty string)",
  "data_model_changes": "Data model changes needed (or empty string)",
  "tasks": [
    {{
      "title": "Task title",
      "context": "What needs to change and why",
      "acceptance_criteria": ["Criterion 1", "Criterion 2"],
      "files_to_modify": ["path/to/file.py"],
      "tests": "What tests to write"
    }}
  ],
  "success_metrics": ["Metric 1", "Metric 2"],
  "evidence_citations": ["Specific evidence items cited"]
}}"""


class Specifier:
    """Generates feature specs from product opportunities."""

    def __init__(self, kg: KnowledgeGraph, model: str = "claude-sonnet-4-20250514"):
        self.kg = kg
        self.model = model

    def specify(self, opportunity: Opportunity) -> FeatureSpec:
        """Generate a full feature spec for an opportunity."""
        console = Console()

        related = self.kg.query(opportunity.title + " " + opportunity.description, n_results=10)
        context_lines = []
        for ev in related:
            preview = ev.content[:200] + "..." if len(ev.content) > 200 else ev.content
            context_lines.append(f"- [{ev.source_type.value}:{ev.connector}] {ev.title}: {preview}")
        context = "\n".join(context_lines) if context_lines else "(no additional context)"

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            task = progress.add_task(f"Specifying: {opportunity.title}...", total=1)

            prompt = SPECIFY_PROMPT.format(
                title=opportunity.title,
                description=opportunity.description,
                evidence_summary=opportunity.evidence_summary,
                context=context,
            )

            try:
                result = ask_json(prompt, system=SPECIFY_SYSTEM, model=self.model)
            except Exception as e:
                console.print(f"[red]Specification failed: {e}[/red]")
                raise

            progress.advance(task)

        tasks = []
        for i, t in enumerate(result.get("tasks", []), 1):
            tasks.append(AgentTask(
                number=i,
                title=t["title"],
                context=t.get("context", ""),
                acceptance_criteria=t.get("acceptance_criteria", []),
                files_to_modify=t.get("files_to_modify", []),
                tests=t.get("tests", ""),
            ))

        return FeatureSpec(
            title=opportunity.title,
            opportunity=opportunity,
            problem_statement=result.get("problem_statement", ""),
            proposed_solution=result.get("proposed_solution", ""),
            ui_changes=result.get("ui_changes", ""),
            data_model_changes=result.get("data_model_changes", ""),
            tasks=tasks,
            success_metrics=result.get("success_metrics", []),
            evidence_citations=result.get("evidence_citations", []),
        )
