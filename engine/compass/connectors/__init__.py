"""Evidence source connectors."""

from compass.connectors.base import Connector
from compass.connectors.github_connector import GitHubConnector
from compass.connectors.docs import DocsConnector
from compass.connectors.analytics import AnalyticsConnector
from compass.connectors.interviews import InterviewConnector
from compass.connectors.support import SupportConnector

CONNECTORS: dict[str, type[Connector]] = {
    "github": GitHubConnector,
    "code": GitHubConnector,
    "docs": DocsConnector,
    "google_docs": DocsConnector,
    "analytics": AnalyticsConnector,
    "data": AnalyticsConnector,
    "interviews": InterviewConnector,
    "support": SupportConnector,
}


def get_connector(connector_type: str) -> type[Connector]:
    """Get a connector class by type name."""
    if connector_type not in CONNECTORS:
        available = ", ".join(CONNECTORS.keys())
        raise ValueError(f"Unknown connector type: {connector_type}. Available: {available}")
    return CONNECTORS[connector_type]


__all__ = [
    "Connector",
    "GitHubConnector",
    "DocsConnector",
    "AnalyticsConnector",
    "InterviewConnector",
    "SupportConnector",
    "CONNECTORS",
    "get_connector",
]
