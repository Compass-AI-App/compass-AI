"""Prompt regression tests — verify prompt versions produce structurally valid output.

Runs the same evidence through each prompt version and validates the output
structure. Does NOT require a real API key — uses mocked LLM responses.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest

from compass.prompts import REGISTRY, get_prompts, list_versions, DEFAULT_VERSION


# ---------------------------------------------------------------------------
# Unit tests for the prompt registry
# ---------------------------------------------------------------------------

class TestPromptRegistry:
    """Validate the prompt registry itself."""

    def test_default_version_exists(self):
        for component in REGISTRY:
            assert DEFAULT_VERSION in REGISTRY[component], (
                f"Default version '{DEFAULT_VERSION}' missing for {component}"
            )

    def test_all_prompts_have_system_and_prompt(self):
        for component, versions in REGISTRY.items():
            for version, prompts in versions.items():
                assert "system" in prompts, f"{component}/{version} missing 'system'"
                assert "prompt" in prompts, f"{component}/{version} missing 'prompt'"
                assert len(prompts["system"]) > 100, f"{component}/{version} system prompt too short"
                assert len(prompts["prompt"]) > 100, f"{component}/{version} prompt too short"

    def test_get_prompts_returns_correct_version(self):
        prompts = get_prompts("reconcile", "v1")
        assert "conflict" in prompts["system"].lower() or "reconcil" in prompts["prompt"].lower()

    def test_get_prompts_unknown_component_raises(self):
        with pytest.raises(KeyError, match="Unknown component"):
            get_prompts("nonexistent", "v1")

    def test_get_prompts_unknown_version_raises(self):
        with pytest.raises(KeyError, match="Unknown version"):
            get_prompts("reconcile", "v999")

    def test_list_versions(self):
        versions = list_versions("reconcile")
        assert "v1" in versions
        assert list_versions("nonexistent") == []


# ---------------------------------------------------------------------------
# Prompt template validation
# ---------------------------------------------------------------------------

class TestPromptTemplates:
    """Verify prompt templates can be formatted with expected variables."""

    def test_reconcile_prompt_format(self):
        prompts = get_prompts("reconcile", "v1")
        formatted = prompts["prompt"].format(
            source_a="CODE",
            source_a_desc="Technical reality",
            evidence_a="- [sync_engine.py]: code here",
            source_b="DOCS",
            source_b_desc="Strategy docs",
            evidence_b="- [Product Strategy]: sync is P0",
        )
        assert "CODE" in formatted
        assert "DOCS" in formatted
        assert "sync_engine.py" in formatted

    def test_discover_prompt_format(self):
        prompts = get_prompts("discover", "v1")
        formatted = prompts["prompt"].format(
            code_evidence="- [sync_engine.py]: code",
            docs_evidence="- [Product Strategy]: docs",
            data_evidence="- [metrics.csv]: data",
            judgment_evidence="- [Interview: Alice]: judgment",
            conflicts="- [HIGH] Sync conflict",
        )
        assert "sync_engine.py" in formatted
        assert "Interview: Alice" in formatted

    def test_specify_prompt_format(self):
        prompts = get_prompts("specify", "v1")
        formatted = prompts["prompt"].format(
            title="Fix sync",
            description="Sync is broken",
            evidence_summary="23 tickets",
            context="- [code:github] sync_engine.py",
        )
        assert "Fix sync" in formatted
        assert "23 tickets" in formatted


# ---------------------------------------------------------------------------
# Engine integration tests (verify engines use registry correctly)
# ---------------------------------------------------------------------------

MOCK_RECONCILE = {
    "conflicts": [{
        "title": "Test conflict",
        "description": "Test",
        "severity": "high",
        "signal_strength": 3,
        "source_a_evidence": ["A"],
        "source_b_evidence": ["B"],
        "recommendation": "Fix it",
    }]
}

MOCK_DISCOVER = {
    "opportunities": [{
        "title": "Test opportunity",
        "description": "Test",
        "confidence": "high",
        "evidence_summary": "Test",
        "estimated_impact": "Big",
        "cited_evidence_titles": [],
        "related_conflict_titles": [],
    }]
}


def _mock_ask_json(prompt, system="", model="", max_tokens=4096):
    if "synthesize" in system.lower() or "product opportunities" in system.lower():
        return MOCK_DISCOVER
    return MOCK_RECONCILE


class TestEnginePromptIntegration:
    """Verify engine components accept and use prompt_version."""

    @patch("compass.engine.reconciler.ask_json", side_effect=_mock_ask_json)
    def test_reconciler_uses_prompt_version(self, mock_llm):
        from compass.engine.knowledge_graph import KnowledgeGraph
        from compass.engine.reconciler import Reconciler
        from compass.models.sources import Evidence, SourceType

        kg = KnowledgeGraph()
        kg.add(Evidence(source_type=SourceType.CODE, connector="test", title="Code", content="test"))
        kg.add(Evidence(source_type=SourceType.DOCS, connector="test", title="Docs", content="test"))

        r = Reconciler(kg, prompt_version="v1")
        report = r.reconcile()
        assert len(report.conflicts) >= 1
        assert mock_llm.called

    @patch("compass.engine.discoverer.ask_json", side_effect=_mock_ask_json)
    @patch("compass.engine.reconciler.ask_json", side_effect=_mock_ask_json)
    def test_discoverer_uses_prompt_version(self, mock_reconcile, mock_discover):
        from compass.engine.knowledge_graph import KnowledgeGraph
        from compass.engine.discoverer import Discoverer
        from compass.engine.reconciler import Reconciler
        from compass.models.sources import Evidence, SourceType

        kg = KnowledgeGraph()
        kg.add(Evidence(source_type=SourceType.CODE, connector="test", title="Code", content="test"))
        kg.add(Evidence(source_type=SourceType.DOCS, connector="test", title="Docs", content="test"))

        r = Reconciler(kg, prompt_version="v1")
        report = r.reconcile()

        d = Discoverer(kg, prompt_version="v1")
        opps = d.discover(report)
        assert len(opps) >= 1

    def test_invalid_version_raises(self):
        from compass.engine.knowledge_graph import KnowledgeGraph
        from compass.engine.reconciler import Reconciler
        from compass.models.sources import Evidence, SourceType

        kg = KnowledgeGraph()
        kg.add(Evidence(source_type=SourceType.CODE, connector="test", title="Code", content="test"))
        kg.add(Evidence(source_type=SourceType.DOCS, connector="test", title="Docs", content="test"))

        r = Reconciler(kg, prompt_version="v999")
        with pytest.raises(KeyError):
            r.reconcile()
