"""Opportunity and specification models — the output of product discovery."""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class Confidence(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class Opportunity(BaseModel):
    """A product opportunity surfaced from evidence synthesis."""

    rank: int
    title: str
    description: str
    confidence: Confidence
    evidence_summary: str
    evidence_ids: list[str] = Field(default_factory=list)
    conflict_ids: list[str] = Field(default_factory=list)
    estimated_impact: str = ""


class AgentTask(BaseModel):
    """A task formatted for consumption by a coding agent (Cursor, Claude Code)."""

    number: int
    title: str
    context: str
    acceptance_criteria: list[str] = Field(default_factory=list)
    files_to_modify: list[str] = Field(default_factory=list)
    tests: str = ""

    def to_markdown(self) -> str:
        lines = [
            f"### Task {self.number}: {self.title}",
            f"**Context:** {self.context}",
        ]
        if self.acceptance_criteria:
            lines.append("**Acceptance criteria:**")
            for ac in self.acceptance_criteria:
                lines.append(f"- {ac}")
        if self.files_to_modify:
            lines.append(f"**Files to modify:** {', '.join(self.files_to_modify)}")
        if self.tests:
            lines.append(f"**Tests:** {self.tests}")
        return "\n".join(lines)


class FeatureSpec(BaseModel):
    """A complete feature specification generated from an opportunity."""

    title: str
    opportunity: Opportunity
    problem_statement: str
    proposed_solution: str
    ui_changes: str = ""
    data_model_changes: str = ""
    tasks: list[AgentTask] = Field(default_factory=list)
    success_metrics: list[str] = Field(default_factory=list)
    evidence_citations: list[str] = Field(default_factory=list)

    def to_markdown(self) -> str:
        lines = [
            f"# Feature Spec: {self.title}",
            "",
            f"**Confidence:** {self.opportunity.confidence.value}",
            f"**Impact:** {self.opportunity.estimated_impact}",
            "",
            "## Problem Statement",
            "",
            self.problem_statement,
            "",
            "## Evidence",
            "",
            self.opportunity.evidence_summary,
            "",
        ]

        if self.evidence_citations:
            lines.append("### Citations")
            lines.append("")
            for cite in self.evidence_citations:
                lines.append(f"- {cite}")
            lines.append("")

        lines.extend([
            "## Proposed Solution",
            "",
            self.proposed_solution,
            "",
        ])

        if self.ui_changes:
            lines.extend(["## UI Changes", "", self.ui_changes, ""])

        if self.data_model_changes:
            lines.extend(["## Data Model Changes", "", self.data_model_changes, ""])

        if self.success_metrics:
            lines.extend(["## Success Metrics", ""])
            for metric in self.success_metrics:
                lines.append(f"- {metric}")
            lines.append("")

        if self.tasks:
            lines.extend([
                "## Agent Tasks",
                "",
                "The following tasks are formatted for coding agents (Cursor, Claude Code).",
                "",
            ])
            for task in self.tasks:
                lines.append(task.to_markdown())
                lines.append("")

        return "\n".join(lines)
