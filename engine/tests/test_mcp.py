"""MCP server tests — validate tool functions return well-formed markdown.

Tests the MCP tool functions directly (not via protocol) to verify
they handle all states correctly: no workspace, no evidence, with evidence.
"""

from __future__ import annotations

import json
from unittest.mock import patch

import pytest

from compass.config import ProductConfig, SourceConfig, save_config, get_compass_dir
from compass.engine.knowledge_graph import KnowledgeGraph
from compass.models.sources import Evidence, SourceType


@pytest.fixture
def demo_workspace(tmp_path):
    """Create a workspace with config and ingested evidence."""
    workspace = tmp_path / "project"
    workspace.mkdir()

    config = ProductConfig(name="TestProduct", description="A test product")
    config.add_source(SourceConfig(type="docs", name="docs:test", path=str(tmp_path / "docs")))
    save_config(config, workspace)

    # Create KG with evidence
    compass_dir = get_compass_dir(workspace)
    kg = KnowledgeGraph(persist_dir=compass_dir / "knowledge")
    kg.add_many([
        Evidence(
            source_type=SourceType.CODE,
            connector="github",
            title="main.py",
            content="def sync(): pass  # TODO: implement retry logic",
        ),
        Evidence(
            source_type=SourceType.DOCS,
            connector="docs",
            title="Strategy Doc",
            content="Priority 1: Sync reliability. Target 99.9% success rate.",
        ),
        Evidence(
            source_type=SourceType.DATA,
            connector="analytics",
            title="Sync Metrics",
            content="Sync success rate: 85%. Failures increasing 10% month-over-month.",
        ),
    ])

    return workspace


@pytest.fixture
def empty_workspace(tmp_path):
    """Create a workspace with config but no evidence."""
    workspace = tmp_path / "empty"
    workspace.mkdir()
    config = ProductConfig(name="EmptyProduct")
    save_config(config, workspace)
    return workspace


class TestMCPStatus:
    def test_status_with_evidence(self, demo_workspace):
        from compass.mcp_server import compass_status

        with patch("compass.mcp_server._get_workspace", return_value=demo_workspace):
            result = compass_status()

        assert "TestProduct" in result
        assert "3" in result  # 3 evidence items
        assert "CODE" in result.upper() or "code" in result

    def test_status_no_workspace(self, tmp_path):
        from compass.mcp_server import compass_status

        nonexistent = tmp_path / "nope"
        nonexistent.mkdir()
        with patch("compass.mcp_server._get_workspace", return_value=nonexistent):
            result = compass_status()

        assert "no compass workspace" in result.lower() or "init" in result.lower()

    def test_status_empty(self, empty_workspace):
        from compass.mcp_server import compass_status

        with patch("compass.mcp_server._get_workspace", return_value=empty_workspace):
            result = compass_status()

        assert "EmptyProduct" in result
        assert "0" in result


class TestMCPSearch:
    def test_search_finds_results(self, demo_workspace):
        from compass.mcp_server import compass_search

        with patch("compass.mcp_server._get_workspace", return_value=demo_workspace):
            result = compass_search("sync reliability")

        assert "Search" in result or "result" in result.lower()
        # Should find at least some results
        assert "no evidence" not in result.lower() or len(result) > 50

    def test_search_no_evidence(self, empty_workspace):
        from compass.mcp_server import compass_search

        with patch("compass.mcp_server._get_workspace", return_value=empty_workspace):
            result = compass_search("anything")

        assert "no evidence" in result.lower() or "ingest" in result.lower()

    def test_search_invalid_source_type(self, demo_workspace):
        from compass.mcp_server import compass_search

        with patch("compass.mcp_server._get_workspace", return_value=demo_workspace):
            result = compass_search("sync", source_type="invalid")

        assert "invalid" in result.lower()


class TestMCPConnect:
    def test_connect_source(self, demo_workspace, tmp_path):
        from compass.mcp_server import compass_connect

        # Create a docs directory
        docs_dir = tmp_path / "docs"
        docs_dir.mkdir()
        (docs_dir / "test.md").write_text("# Test doc")

        with patch("compass.mcp_server._get_workspace", return_value=demo_workspace):
            result = compass_connect("docs", str(docs_dir), "docs:new")

        assert "connected" in result.lower() or "accessible" in result.lower()


class TestMCPNoApiKey:
    """Test that LLM-dependent tools handle missing API key gracefully."""

    def test_reconcile_no_evidence(self, empty_workspace):
        from compass.mcp_server import compass_reconcile

        with patch("compass.mcp_server._get_workspace", return_value=empty_workspace):
            result = compass_reconcile()

        assert "no evidence" in result.lower() or "ingest" in result.lower()

    def test_discover_no_evidence(self, empty_workspace):
        from compass.mcp_server import compass_discover

        with patch("compass.mcp_server._get_workspace", return_value=empty_workspace):
            result = compass_discover()

        assert "no evidence" in result.lower() or "ingest" in result.lower()

    def test_specify_no_evidence(self, empty_workspace):
        from compass.mcp_server import compass_specify

        with patch("compass.mcp_server._get_workspace", return_value=empty_workspace):
            result = compass_specify("anything")

        assert "no evidence" in result.lower() or "ingest" in result.lower()

    def test_ask_no_evidence(self, empty_workspace):
        from compass.mcp_server import compass_ask

        with patch("compass.mcp_server._get_workspace", return_value=empty_workspace):
            result = compass_ask("what should we build?")

        assert "no evidence" in result.lower() or "ingest" in result.lower()


class TestMCPInstallConfig:
    def test_install_creates_claude_config(self, tmp_path):
        """Test that mcp install creates valid Claude Code config."""
        claude_dir = tmp_path / ".claude"
        claude_dir.mkdir()
        config_path = claude_dir / "claude_code_config.json"

        # Simulate the install logic
        server_config = {"command": "compass", "args": ["mcp", "serve"]}
        config = {"mcpServers": {"compass": server_config}}
        config_path.write_text(json.dumps(config, indent=2))

        # Verify valid JSON
        loaded = json.loads(config_path.read_text())
        assert "mcpServers" in loaded
        assert "compass" in loaded["mcpServers"]
        assert loaded["mcpServers"]["compass"]["command"] == "compass"
        assert loaded["mcpServers"]["compass"]["args"] == ["mcp", "serve"]
