"""Conflict models — where sources of truth disagree.

The unique value of Compass: surfacing where Code, Docs, Data,
and Judgment tell different stories about the product.
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field

from compass.models.sources import SourceType


class ConflictSeverity(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ConflictType(str, Enum):
    """The six possible conflicts between four sources."""

    CODE_VS_DOCS = "code_vs_docs"  # "We claim X but code shows Y"
    CODE_VS_DATA = "code_vs_data"  # "Feature exists but isn't used"
    CODE_VS_JUDGMENT = "code_vs_judgment"  # "Code does X but users want Y"
    DOCS_VS_DATA = "docs_vs_data"  # "Strategy says X, metrics show Y"
    DOCS_VS_JUDGMENT = "docs_vs_judgment"  # "Roadmap says X, users want Y"
    DATA_VS_JUDGMENT = "data_vs_judgment"  # "Metrics show X, team believes Y"

    @property
    def sources(self) -> tuple[SourceType, SourceType]:
        mapping = {
            ConflictType.CODE_VS_DOCS: (SourceType.CODE, SourceType.DOCS),
            ConflictType.CODE_VS_DATA: (SourceType.CODE, SourceType.DATA),
            ConflictType.CODE_VS_JUDGMENT: (SourceType.CODE, SourceType.JUDGMENT),
            ConflictType.DOCS_VS_DATA: (SourceType.DOCS, SourceType.DATA),
            ConflictType.DOCS_VS_JUDGMENT: (SourceType.DOCS, SourceType.JUDGMENT),
            ConflictType.DATA_VS_JUDGMENT: (SourceType.DATA, SourceType.JUDGMENT),
        }
        return mapping[self]

    @property
    def description(self) -> str:
        descriptions = {
            ConflictType.CODE_VS_DOCS: "Technical reality vs. documented expectations",
            ConflictType.CODE_VS_DATA: "Code capabilities vs. actual usage",
            ConflictType.CODE_VS_JUDGMENT: "Technical reality vs. user needs",
            ConflictType.DOCS_VS_DATA: "Strategy vs. empirical evidence",
            ConflictType.DOCS_VS_JUDGMENT: "Plans vs. user feedback",
            ConflictType.DATA_VS_JUDGMENT: "Metrics vs. qualitative insight",
        }
        return descriptions[self]


class Conflict(BaseModel):
    """A detected conflict between two sources of truth."""

    conflict_type: ConflictType
    severity: ConflictSeverity
    title: str
    description: str
    source_a_evidence: list[str] = Field(default_factory=list)  # evidence IDs
    source_b_evidence: list[str] = Field(default_factory=list)
    recommendation: str = ""
    signal_strength: int = 1  # how many independent evidence items support this conflict


class ConflictReport(BaseModel):
    """All conflicts found during reconciliation."""

    conflicts: list[Conflict] = Field(default_factory=list)

    @property
    def high(self) -> list[Conflict]:
        return [c for c in self.conflicts if c.severity == ConflictSeverity.HIGH]

    @property
    def by_type(self) -> dict[str, list[Conflict]]:
        result: dict[str, list[Conflict]] = {}
        for c in self.conflicts:
            key = c.conflict_type.value
            result.setdefault(key, []).append(c)
        return result

    def __len__(self) -> int:
        return len(self.conflicts)
