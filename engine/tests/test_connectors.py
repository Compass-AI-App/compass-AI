"""Tests for the 5 evidence connectors: GitHub, Docs, Analytics, Interviews, Support."""

import csv

import pytest

from compass.config import SourceConfig
from compass.connectors.github_connector import GitHubConnector
from compass.connectors.docs import DocsConnector
from compass.connectors.analytics import AnalyticsConnector
from compass.connectors.interviews import InterviewConnector
from compass.connectors.support import SupportConnector
from compass.models.sources import SourceType


# ---------- Fixtures ----------

@pytest.fixture
def code_repo(tmp_path):
    """Create a minimal code repo fixture."""
    readme = tmp_path / "README.md"
    readme.write_text("# Test Project\nA test project for Compass.")
    src = tmp_path / "src"
    src.mkdir()
    (src / "main.py").write_text("def main():\n    print('hello')\n")
    (src / "utils.py").write_text("def helper():\n    return 42\n")
    return tmp_path


@pytest.fixture
def docs_dir(tmp_path):
    """Create a docs directory fixture."""
    (tmp_path / "strategy.md").write_text("# Product Strategy\nOur strategy is mobile-first.")
    (tmp_path / "roadmap.md").write_text("# Roadmap\n## Q1\n- Feature A\n- Feature B")
    return tmp_path


@pytest.fixture
def analytics_csv(tmp_path):
    """Create an analytics CSV fixture."""
    csv_path = tmp_path / "usage.csv"
    with open(csv_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["feature", "daily_active_users", "retention_7d"])
        writer.writeheader()
        writer.writerow({"feature": "sync", "daily_active_users": "1200", "retention_7d": "45%"})
        writer.writerow({"feature": "export", "daily_active_users": "300", "retention_7d": "60%"})
    return csv_path


@pytest.fixture
def interviews_dir(tmp_path):
    """Create interview transcripts fixture."""
    (tmp_path / "interview-alice.md").write_text(
        "# Customer Interview: Alice\nAlice uses sync daily but finds it unreliable."
    )
    (tmp_path / "interview-bob.md").write_text(
        "# Customer Interview: Bob\nBob wants batch export functionality."
    )
    return tmp_path


@pytest.fixture
def support_csv(tmp_path):
    """Create a support tickets CSV fixture."""
    csv_path = tmp_path / "tickets.csv"
    with open(csv_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["title", "description", "category"])
        writer.writeheader()
        writer.writerow({"title": "Sync fails", "description": "Sync crashes on large files", "category": "bug"})
        writer.writerow({"title": "Export request", "description": "Need CSV export", "category": "feature"})
        writer.writerow({"title": "Sync timeout", "description": "Sync times out after 30s", "category": "bug"})
    return csv_path


# ---------- GitHub Connector ----------

class TestGitHubConnector:
    def test_validate_local_path(self, code_repo):
        config = SourceConfig(type="github", name="test-repo", path=str(code_repo))
        connector = GitHubConnector(config)
        assert connector.validate() is True

    def test_validate_missing_path(self):
        config = SourceConfig(type="github", name="test-repo", path="/nonexistent/path")
        connector = GitHubConnector(config)
        assert connector.validate() is False

    def test_ingest_local(self, code_repo):
        config = SourceConfig(type="github", name="test-repo", path=str(code_repo))
        connector = GitHubConnector(config)
        evidence = connector.ingest()
        assert len(evidence) > 0
        assert all(e.source_type == SourceType.CODE for e in evidence)
        # Should have README and source files
        titles = [e.title for e in evidence]
        assert any("README" in t for t in titles)


# ---------- Docs Connector ----------

class TestDocsConnector:
    def test_validate(self, docs_dir):
        config = SourceConfig(type="docs", name="strategy", path=str(docs_dir))
        connector = DocsConnector(config)
        assert connector.validate() is True

    def test_validate_missing(self):
        config = SourceConfig(type="docs", name="strategy", path="/nonexistent")
        connector = DocsConnector(config)
        assert connector.validate() is False

    def test_ingest_directory(self, docs_dir):
        config = SourceConfig(type="docs", name="strategy", path=str(docs_dir))
        connector = DocsConnector(config)
        evidence = connector.ingest()
        assert len(evidence) == 2
        assert all(e.source_type == SourceType.DOCS for e in evidence)

    def test_ingest_single_file(self, docs_dir):
        config = SourceConfig(type="docs", name="strategy", path=str(docs_dir / "strategy.md"))
        connector = DocsConnector(config)
        evidence = connector.ingest()
        assert len(evidence) == 1
        assert "Product Strategy" in evidence[0].title


# ---------- Analytics Connector ----------

class TestAnalyticsConnector:
    def test_validate(self, analytics_csv):
        config = SourceConfig(type="analytics", name="metrics", path=str(analytics_csv))
        connector = AnalyticsConnector(config)
        assert connector.validate() is True

    def test_ingest_csv(self, analytics_csv):
        config = SourceConfig(type="analytics", name="metrics", path=str(analytics_csv))
        connector = AnalyticsConnector(config)
        evidence = connector.ingest()
        assert len(evidence) >= 1
        assert all(e.source_type == SourceType.DATA for e in evidence)
        assert "usage" in evidence[0].title.lower()


# ---------- Interview Connector ----------

class TestInterviewConnector:
    def test_validate(self, interviews_dir):
        config = SourceConfig(type="interviews", name="research", path=str(interviews_dir))
        connector = InterviewConnector(config)
        assert connector.validate() is True

    def test_ingest(self, interviews_dir):
        config = SourceConfig(type="interviews", name="research", path=str(interviews_dir))
        connector = InterviewConnector(config)
        evidence = connector.ingest()
        assert len(evidence) == 2
        assert all(e.source_type == SourceType.JUDGMENT for e in evidence)
        assert all(e.connector == "interviews" for e in evidence)


# ---------- Support Connector ----------

class TestSupportConnector:
    def test_validate(self, support_csv):
        config = SourceConfig(type="support", name="tickets", path=str(support_csv))
        connector = SupportConnector(config)
        assert connector.validate() is True

    def test_ingest_csv(self, support_csv):
        config = SourceConfig(type="support", name="tickets", path=str(support_csv))
        connector = SupportConnector(config)
        evidence = connector.ingest()
        assert len(evidence) >= 1
        assert all(e.source_type == SourceType.JUDGMENT for e in evidence)
        # Should have category summaries since our CSV has a category column
        categories = [e for e in evidence if "bug" in e.title.lower() or "feature" in e.title.lower()]
        assert len(categories) >= 1
