"""Prototype models — self-contained HTML prototypes from evidence."""

from __future__ import annotations

from pydantic import BaseModel, Field


class PrototypeIteration(BaseModel):
    """A single iteration of a prototype."""
    prompt: str = ""
    html: str = ""


class Prototype(BaseModel):
    """A generated UI prototype."""
    title: str
    type: str = "landing-page"  # landing-page, dashboard, form, pricing-page, onboarding-flow
    html: str = ""
    description: str = ""
    iterations: list[PrototypeIteration] = Field(default_factory=list)
    evidence_ids: list[str] = Field(default_factory=list)
