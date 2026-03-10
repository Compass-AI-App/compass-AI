"""Tests for core data models: Evidence, EvidenceStore, Conflict, Opportunity, FeatureSpec."""

from datetime import datetime

from compass.models.sources import Evidence, EvidenceStore, SourceType
from compass.models.conflicts import Conflict, ConflictReport, ConflictType, ConflictSeverity
from compass.models.specs import Opportunity, FeatureSpec, AgentTask, Confidence


def _make_evidence(source_type=SourceType.CODE, connector="github", title="Test", content="test content"):
    return Evidence(source_type=source_type, connector=connector, title=title, content=content)


class TestEvidence:
    def test_create_evidence(self):
        e = _make_evidence()
        assert e.source_type == SourceType.CODE
        assert e.connector == "github"
        assert e.title == "Test"
        assert len(e.id) == 12

    def test_evidence_short(self):
        e = _make_evidence(title="README")
        assert e.short == "[code:github] README"

    def test_evidence_timestamp_default(self):
        e = _make_evidence()
        assert isinstance(e.timestamp, datetime)


class TestEvidenceStore:
    def test_add_and_len(self):
        store = EvidenceStore()
        store.add(_make_evidence())
        assert len(store) == 1

    def test_add_many(self):
        store = EvidenceStore()
        store.add_many([_make_evidence(), _make_evidence(source_type=SourceType.DOCS)])
        assert len(store) == 2

    def test_by_source(self):
        store = EvidenceStore()
        store.add_many([
            _make_evidence(source_type=SourceType.CODE),
            _make_evidence(source_type=SourceType.DOCS),
            _make_evidence(source_type=SourceType.CODE),
        ])
        assert len(store.by_source(SourceType.CODE)) == 2
        assert len(store.by_source(SourceType.DOCS)) == 1
        assert len(store.by_source(SourceType.DATA)) == 0

    def test_by_connector(self):
        store = EvidenceStore()
        store.add_many([
            _make_evidence(connector="github"),
            _make_evidence(connector="docs"),
        ])
        assert len(store.by_connector("github")) == 1

    def test_summary(self):
        store = EvidenceStore()
        store.add_many([
            _make_evidence(source_type=SourceType.CODE),
            _make_evidence(source_type=SourceType.CODE),
            _make_evidence(source_type=SourceType.DATA),
        ])
        summary = store.summary
        assert summary["code"] == 2
        assert summary["data"] == 1


class TestConflict:
    def test_create_conflict(self):
        c = Conflict(
            conflict_type=ConflictType.CODE_VS_DOCS,
            severity=ConflictSeverity.HIGH,
            title="Strategy mismatch",
            description="Code says X, docs say Y",
            recommendation="Align them",
        )
        assert c.conflict_type == ConflictType.CODE_VS_DOCS
        assert c.severity == ConflictSeverity.HIGH

    def test_conflict_type_sources(self):
        ct = ConflictType.DOCS_VS_DATA
        assert ct.sources == (SourceType.DOCS, SourceType.DATA)

    def test_conflict_report(self):
        report = ConflictReport(conflicts=[
            Conflict(
                conflict_type=ConflictType.CODE_VS_DOCS,
                severity=ConflictSeverity.HIGH,
                title="High",
                description="d",
            ),
            Conflict(
                conflict_type=ConflictType.DOCS_VS_DATA,
                severity=ConflictSeverity.LOW,
                title="Low",
                description="d",
            ),
        ])
        assert len(report) == 2
        assert len(report.high) == 1


class TestOpportunity:
    def test_create_opportunity(self):
        opp = Opportunity(
            rank=1,
            title="Fix sync",
            description="Sync is broken",
            confidence=Confidence.HIGH,
            evidence_summary="23 tickets",
        )
        assert opp.rank == 1
        assert opp.confidence == Confidence.HIGH


class TestFeatureSpec:
    def test_to_markdown(self):
        spec = FeatureSpec(
            title="Fix Sync",
            opportunity=Opportunity(
                rank=1,
                title="Fix sync",
                description="desc",
                confidence=Confidence.HIGH,
                evidence_summary="evidence",
                estimated_impact="High impact",
            ),
            problem_statement="Sync is unreliable",
            proposed_solution="Add retry logic",
            tasks=[
                AgentTask(
                    number=1,
                    title="Add retries",
                    context="The sync module needs retries",
                    acceptance_criteria=["Retries up to 3 times"],
                    files_to_modify=["src/sync.py"],
                    tests="Add test_retry",
                ),
            ],
            success_metrics=["Sync failures drop by 80%"],
            evidence_citations=["Support ticket #142"],
        )
        md = spec.to_markdown()
        assert "# Feature Spec: Fix Sync" in md
        assert "Sync is unreliable" in md
        assert "Add retry logic" in md
        assert "Task 1: Add retries" in md
        assert "src/sync.py" in md
