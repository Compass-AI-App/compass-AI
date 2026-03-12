"""Presentation models — structured slide decks from evidence."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ContentBlock(BaseModel):
    """A single content block within a slide."""
    type: str  # heading, text, bullet_list, quote, chart_spec, image_placeholder, evidence_citation
    content: str = ""
    items: list[str] = Field(default_factory=list)  # for bullet_list
    attrs: dict = Field(default_factory=dict)  # for chart_spec, image, etc.


class Slide(BaseModel):
    """A single slide in a presentation."""
    title: str = ""
    layout: str = "content"  # title, content, two-column, image-left, chart, quote
    content_blocks: list[ContentBlock] = Field(default_factory=list)
    speaker_notes: str = ""


class Presentation(BaseModel):
    """A structured slide deck."""
    title: str
    subtitle: str = ""
    audience: str = ""  # engineering, leadership, board, customer, cross-functional
    slides: list[Slide] = Field(default_factory=list)
    evidence_citations: list[str] = Field(default_factory=list)
