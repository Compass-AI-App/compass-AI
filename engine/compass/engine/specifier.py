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


SPECIFY_SYSTEM = """You are Compass, a product specification engine. You turn product
opportunities into detailed, agent-ready feature specifications.

Your specs must be detailed enough that a coding agent (Cursor or Claude Code) can
execute them WITHOUT asking clarifying questions. This means:

1. Problem statement cites specific evidence items — not generic descriptions
2. Proposed solution is broken into numbered implementation steps
3. Each task includes exact files to modify (inferred from code evidence when available)
4. Every task has testable acceptance criteria
5. Testing requirements are specific: what to test, how, and expected outcomes

The spec is the bridge between "what to build" (product discovery) and "build it"
(coding agent execution). If the spec is vague, the implementation will be wrong."""

SPECIFY_PROMPT = """Generate a detailed, agent-ready feature specification for this opportunity.

## Opportunity
**{title}**
{description}

## Supporting Evidence
{evidence_summary}

## Related Product Context (from the codebase and other sources)
{context}

## Instructions

Create a specification detailed enough for a coding agent to implement without
asking questions. Include:

1. **Problem statement** — cite specific evidence items that demonstrate the problem.
   Bad: "Users have issues with sync." Good: "23 support tickets (Support tickets: tickets)
   report sync failures. Interview with Alice confirms 'sync crashes on files over 10MB'."

2. **Proposed solution** — describe the solution as numbered implementation steps, not
   a vague description. Reference specific modules/files from the code evidence.

3. **Task breakdown** — each task must have:
   - Context: what needs to change, why, and how it connects to the solution
   - Files to modify: specific file paths from the codebase evidence (use paths from
     the "Related Product Context" section)
   - Acceptance criteria: testable boolean conditions (not "works well" but
     "sync retries up to 3 times with exponential backoff starting at 1s")
   - Tests: specific test scenarios and expected outcomes

4. **Success metrics** — how the team will know this worked, tied back to the evidence

Respond as JSON:
{{
  "problem_statement": "Evidence-grounded problem with specific citations",
  "proposed_solution": "Numbered implementation steps referencing specific modules/files",
  "ui_changes": "UI changes needed (or empty string if none)",
  "data_model_changes": "Data model changes needed (or empty string if none)",
  "tasks": [
    {{
      "title": "Specific task title",
      "context": "What needs to change, why, and how it fits the overall solution",
      "acceptance_criteria": ["Testable criterion 1", "Testable criterion 2"],
      "files_to_modify": ["exact/path/to/file.py", "exact/path/to/other.py"],
      "tests": "Specific test scenarios: test X does Y, test A handles B"
    }}
  ],
  "success_metrics": ["Measurable metric tied to evidence"],
  "evidence_citations": ["Exact title of cited evidence item 1", "Exact title 2"]
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
