"""Base connector interface."""

from __future__ import annotations

from abc import ABC, abstractmethod

from compass.config import SourceConfig
from compass.models.sources import Evidence


class Connector(ABC):
    """Base class for evidence source connectors."""

    connector_type: str = ""

    def __init__(self, config: SourceConfig):
        self.config = config

    @abstractmethod
    def ingest(self) -> list[Evidence]:
        """Pull evidence from the source. Returns a list of Evidence items."""
        ...

    @abstractmethod
    def validate(self) -> bool:
        """Check that the source is accessible."""
        ...
