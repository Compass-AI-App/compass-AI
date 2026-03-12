"""Dashboard models for chart specs."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ChartSpec(BaseModel):
    """Specification for a single chart."""
    type: str = "bar"  # bar, line, pie, area, radar
    title: str = ""
    data: list[dict] = Field(default_factory=list)
    x_key: str = "label"
    y_keys: list[str] = Field(default_factory=lambda: ["value"])


class DashboardSpec(BaseModel):
    """Specification for a dashboard with multiple charts."""
    title: str = ""
    charts: list[ChartSpec] = Field(default_factory=list)
