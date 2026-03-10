"""Output quality benchmark — validates that AI output meets quality bars.

This test requires ANTHROPIC_API_KEY and makes real LLM calls.
It is NOT run in CI — run manually to validate prompt changes:

    cd engine && ANTHROPIC_API_KEY=sk-ant-... python -m pytest tests/test_output_quality.py -v -s

Marked with @pytest.mark.slow so it's excluded from default test runs.
"""

from __future__ import annotations

import os

import pytest

from compass.engine.knowledge_graph import KnowledgeGraph
from compass.models.sources import Evidence, SourceType


pytestmark = pytest.mark.skipif(
    not os.environ.get("ANTHROPIC_API_KEY"),
    reason="Requires ANTHROPIC_API_KEY — run manually for quality validation",
)


def _create_demo_evidence() -> list[Evidence]:
    """Create realistic demo evidence across all four source types."""
    return [
        # CODE evidence
        Evidence(
            source_type=SourceType.CODE,
            connector="github",
            title="sync_engine.py — SyncManager class",
            content=(
                "class SyncManager:\n"
                "    MAX_RETRIES = 1  # TODO: increase this\n"
                "    TIMEOUT = 30\n"
                "    def sync(self, file):\n"
                "        # No retry logic, just fails on network error\n"
                "        response = self.api.upload(file)\n"
                "        if response.status != 200:\n"
                "            raise SyncError(f'Upload failed: {response.status}')\n"
                "        # No size check before upload\n"
                "        return response\n"
            ),
        ),
        Evidence(
            source_type=SourceType.CODE,
            connector="github",
            title="api_client.py — rate limiting",
            content=(
                "class APIClient:\n"
                "    def __init__(self):\n"
                "        self.rate_limit = None  # Not implemented\n"
                "    def request(self, endpoint, data):\n"
                "        # Synchronous HTTP call, blocks the main thread\n"
                "        return requests.post(f'{self.base_url}/{endpoint}', json=data)\n"
            ),
        ),
        Evidence(
            source_type=SourceType.CODE,
            connector="github",
            title="models/file.py — File model",
            content=(
                "class File(BaseModel):\n"
                "    name: str\n"
                "    size: int  # bytes\n"
                "    last_synced: datetime | None = None\n"
                "    sync_status: str = 'pending'  # pending, syncing, synced, failed\n"
                "    error_count: int = 0\n"
            ),
        ),

        # DOCS evidence
        Evidence(
            source_type=SourceType.DOCS,
            connector="docs",
            title="Q1 Product Strategy",
            content=(
                "Priority 1: Real-time sync reliability\n"
                "We need sync to be rock-solid. Users should never lose data.\n"
                "Target: 99.9% sync success rate by end of Q1.\n"
                "Key requirement: Files up to 100MB should sync within 10 seconds.\n"
            ),
        ),
        Evidence(
            source_type=SourceType.DOCS,
            connector="docs",
            title="Architecture Decision: Async Migration",
            content=(
                "Decision: Migrate all API calls to async by Q2.\n"
                "Status: NOT STARTED\n"
                "Rationale: Blocking calls cause UI freezes during sync.\n"
                "This is a prerequisite for the real-time collaboration feature.\n"
            ),
        ),
        Evidence(
            source_type=SourceType.DOCS,
            connector="docs",
            title="Onboarding PRD",
            content=(
                "New user onboarding flow:\n"
                "1. Sign up → 2. Connect first source → 3. Initial sync → 4. Tutorial\n"
                "Goal: 80% of users complete onboarding within 5 minutes.\n"
                "Current completion rate: unknown (no tracking).\n"
            ),
        ),

        # DATA evidence
        Evidence(
            source_type=SourceType.DATA,
            connector="analytics",
            title="Sync failure rate — last 30 days",
            content=(
                "Sync success rate: 87.3% (target: 99.9%)\n"
                "Failures by cause:\n"
                "  - Timeout (file > 10MB): 45% of failures\n"
                "  - Network error (no retry): 30% of failures\n"
                "  - Rate limit exceeded: 15% of failures\n"
                "  - Unknown: 10% of failures\n"
                "Average file size at failure: 23MB\n"
                "P95 sync duration: 47 seconds (target: 10 seconds)\n"
            ),
        ),
        Evidence(
            source_type=SourceType.DATA,
            connector="analytics",
            title="User retention — cohort analysis",
            content=(
                "Day 1 retention: 62%\n"
                "Day 7 retention: 34%\n"
                "Day 30 retention: 18%\n"
                "Users who experience sync failure in first session: 41% churn within 24h\n"
                "Users with successful first sync: 12% churn within 24h\n"
                "Sync failure is the #1 predictor of churn.\n"
            ),
        ),

        # JUDGMENT evidence
        Evidence(
            source_type=SourceType.JUDGMENT,
            connector="support",
            title="Support tickets — sync issues (23 tickets)",
            content=(
                "Top complaints:\n"
                "- 'Sync keeps failing on my large files' (9 tickets)\n"
                "- 'App freezes when syncing' (6 tickets)\n"
                "- 'I lost my changes after sync failed' (5 tickets)\n"
                "- 'No way to know if sync worked' (3 tickets)\n"
                "Average resolution time: 2.3 days\n"
                "Sentiment: overwhelmingly negative\n"
            ),
        ),
        Evidence(
            source_type=SourceType.JUDGMENT,
            connector="interviews",
            title="Interview: Alice (power user, 6 months)",
            content=(
                "Alice: 'I love the product but sync is killing me. I have to manually "
                "check if files synced every time. Last week I lost 2 hours of work because "
                "sync failed silently on a 15MB file. I've started using Dropbox as a backup, "
                "which defeats the purpose.'\n"
                "Interviewer: 'What would make sync trustworthy?'\n"
                "Alice: 'Show me clearly what synced and what didn't. Retry automatically. "
                "And for god's sake, handle large files.'\n"
            ),
        ),
        Evidence(
            source_type=SourceType.JUDGMENT,
            connector="interviews",
            title="Interview: Bob (new user, 2 weeks)",
            content=(
                "Bob: 'I signed up because the onboarding looked simple, but I couldn't get "
                "my files to sync on the first try. The app just showed an error with no "
                "explanation. I almost gave up. A friend told me to try smaller files first, "
                "which worked, but that shouldn't be something you have to figure out.'\n"
            ),
        ),
    ]


@pytest.fixture
def demo_kg(tmp_path):
    """Create a KG loaded with demo evidence."""
    kg = KnowledgeGraph(persist_dir=tmp_path / "knowledge")
    kg.add_many(_create_demo_evidence())
    return kg


class TestReconciliationQuality:
    """Validate that reconciliation output meets quality bars."""

    def test_finds_conflicts(self, demo_kg):
        from compass.engine.reconciler import Reconciler

        reconciler = Reconciler(demo_kg)
        report = reconciler.reconcile()

        # Must find at least 2 conflicts
        assert len(report) >= 2, f"Expected >= 2 conflicts, got {len(report)}"

        # Every conflict must have a non-empty recommendation
        for conflict in report.conflicts:
            assert conflict.recommendation.strip(), (
                f"Conflict '{conflict.title}' has empty recommendation"
            )

        # HIGH severity conflicts must reference both sources
        for conflict in report.high:
            assert conflict.source_a_evidence, (
                f"HIGH conflict '{conflict.title}' missing source A evidence"
            )
            assert conflict.source_b_evidence, (
                f"HIGH conflict '{conflict.title}' missing source B evidence"
            )

        # No duplicate conflict titles
        titles = [c.title for c in report.conflicts]
        assert len(titles) == len(set(titles)), f"Duplicate conflicts: {titles}"

    def test_signal_strength_populated(self, demo_kg):
        from compass.engine.reconciler import Reconciler

        reconciler = Reconciler(demo_kg)
        report = reconciler.reconcile()

        for conflict in report.conflicts:
            assert conflict.signal_strength >= 1, (
                f"Conflict '{conflict.title}' has signal_strength < 1"
            )


class TestDiscoveryQuality:
    """Validate that discovery output meets quality bars."""

    def test_finds_opportunities(self, demo_kg):
        from compass.engine.reconciler import Reconciler
        from compass.engine.discoverer import Discoverer

        reconciler = Reconciler(demo_kg)
        report = reconciler.reconcile()

        discoverer = Discoverer(demo_kg)
        opportunities = discoverer.discover(report)

        # Must find at least 3 opportunities
        assert len(opportunities) >= 3, f"Expected >= 3 opportunities, got {len(opportunities)}"

        # Opportunities are ranked
        for i, opp in enumerate(opportunities):
            assert opp.rank == i + 1, f"Opportunity '{opp.title}' has rank {opp.rank}, expected {i + 1}"

        # Every opportunity has non-empty evidence_summary
        for opp in opportunities:
            assert opp.evidence_summary.strip(), (
                f"Opportunity '{opp.title}' has empty evidence_summary"
            )

    def test_high_confidence_multi_source(self, demo_kg):
        from compass.engine.reconciler import Reconciler
        from compass.engine.discoverer import Discoverer
        from compass.models.specs import Confidence

        reconciler = Reconciler(demo_kg)
        report = reconciler.reconcile()

        discoverer = Discoverer(demo_kg)
        opportunities = discoverer.discover(report)

        high_confidence = [o for o in opportunities if o.confidence == Confidence.HIGH]
        # If there are HIGH confidence opportunities, they should cite multiple source types
        for opp in high_confidence:
            summary_lower = opp.evidence_summary.lower()
            source_mentions = sum(1 for s in ["code", "docs", "data", "support", "interview", "ticket"]
                                  if s in summary_lower)
            assert source_mentions >= 2, (
                f"HIGH confidence '{opp.title}' should cite 2+ source types, "
                f"evidence_summary mentions {source_mentions}"
            )


class TestSpecificationQuality:
    """Validate that specification output meets quality bars."""

    def test_spec_quality(self, demo_kg):
        from compass.engine.reconciler import Reconciler
        from compass.engine.discoverer import Discoverer
        from compass.engine.specifier import Specifier

        reconciler = Reconciler(demo_kg)
        report = reconciler.reconcile()

        discoverer = Discoverer(demo_kg)
        opportunities = discoverer.discover(report)
        assert opportunities, "No opportunities to specify"

        specifier = Specifier(demo_kg)
        spec = specifier.specify(opportunities[0])

        # Problem statement cites evidence
        assert spec.problem_statement.strip(), "Empty problem statement"
        assert len(spec.problem_statement) > 50, "Problem statement too short to be evidence-grounded"

        # At least 2 agent tasks
        assert len(spec.tasks) >= 2, f"Expected >= 2 tasks, got {len(spec.tasks)}"

        # Each task has acceptance criteria
        for task in spec.tasks:
            assert task.acceptance_criteria, (
                f"Task '{task.title}' has no acceptance criteria"
            )

        # Export formats work
        cursor_md = spec.to_cursor_markdown()
        claude_md = spec.to_claude_code_markdown()
        assert len(cursor_md) > 100, "Cursor markdown too short"
        assert len(claude_md) > 100, "Claude Code markdown too short"
        assert cursor_md != claude_md, "Export formats should differ"
