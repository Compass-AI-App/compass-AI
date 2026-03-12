"""Prototyper engine — generates self-contained HTML prototypes from evidence.

Takes a description and evidence context, uses LLM to create a Prototype
with self-contained HTML using Tailwind CSS CDN.
"""

from __future__ import annotations

import logging
import re

from compass.engine.knowledge_graph import KnowledgeGraph
from compass.engine.llm import ask
from compass.models.prototypes import Prototype, PrototypeIteration
from compass.models.sources import Evidence
from compass.prompts import get_prompts, DEFAULT_VERSION

logger = logging.getLogger(__name__)

VALID_TYPES = {"landing-page", "dashboard", "form", "pricing-page", "onboarding-flow"}


def _format_evidence(items: list[Evidence], max_items: int = 20) -> str:
    """Format evidence for the prototype prompt."""
    if not items:
        return "(no evidence available)"
    lines = []
    for item in items[:max_items]:
        preview = item.content[:300] + "..." if len(item.content) > 300 else item.content
        lines.append(f"- [{item.source_type.value}] **{item.title}**: {preview}")
    return "\n".join(lines)


def _clean_html(raw: str) -> str:
    """Strip markdown code fences if LLM wraps output."""
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:html)?\s*\n?", "", raw)
        raw = re.sub(r"\n?```\s*$", "", raw)
    return raw.strip()


class Prototyper:
    """Generates self-contained HTML prototypes from evidence."""

    def __init__(self, kg: KnowledgeGraph, model: str = "claude-sonnet-4-20250514", prompt_version: str = DEFAULT_VERSION):
        self.kg = kg
        self.model = model
        self.prompt_version = prompt_version

    def generate(
        self,
        description: str,
        prototype_type: str = "landing-page",
        evidence_ids: list[str] | None = None,
    ) -> Prototype:
        """Generate a prototype from evidence.

        Args:
            description: What the prototype should show.
            prototype_type: Type of prototype to generate.
            evidence_ids: Specific evidence IDs to use (optional).

        Returns:
            Prototype with self-contained HTML.
        """
        if prototype_type not in VALID_TYPES:
            prototype_type = "landing-page"

        # Gather evidence
        if evidence_ids:
            evidence = [self.kg.get_by_id(eid) for eid in evidence_ids]
            evidence = [e for e in evidence if e is not None]
        else:
            evidence = self.kg.query(description, n_results=20)

        evidence_ids_used = [e.id for e in evidence]

        prompts = get_prompts("prototype", self.prompt_version)

        prompt = prompts["prompt"].format(
            description=description,
            prototype_type=prototype_type,
            evidence_context=_format_evidence(evidence),
        )

        raw_html = ask(prompt, system=prompts["system"], model=self.model, max_tokens=16384)
        html = _clean_html(raw_html)

        title = self._extract_title(html, description)

        return Prototype(
            title=title,
            type=prototype_type,
            html=html,
            description=description,
            iterations=[PrototypeIteration(prompt=description, html=html)],
            evidence_ids=evidence_ids_used,
        )

    def iterate(
        self,
        prototype: Prototype,
        iteration_prompt: str,
    ) -> Prototype:
        """Iterate on an existing prototype.

        Args:
            prototype: The current prototype to improve.
            iteration_prompt: What to change.

        Returns:
            Updated Prototype with new iteration appended.
        """
        prompts = get_prompts("prototype", self.prompt_version)

        prompt = (
            f"Here is the current HTML prototype:\n\n{prototype.html}\n\n"
            f"Please modify it according to this request:\n{iteration_prompt}\n\n"
            f"Output ONLY the complete updated HTML document."
        )

        raw_html = ask(prompt, system=prompts["system"], model=self.model, max_tokens=16384)
        html = _clean_html(raw_html)

        prototype.html = html
        prototype.iterations.append(PrototypeIteration(prompt=iteration_prompt, html=html))

        return prototype

    def _extract_title(self, html: str, fallback: str) -> str:
        """Extract title from HTML <title> tag or use fallback."""
        match = re.search(r"<title>(.*?)</title>", html, re.IGNORECASE)
        if match:
            return match.group(1).strip()
        return fallback[:80]
