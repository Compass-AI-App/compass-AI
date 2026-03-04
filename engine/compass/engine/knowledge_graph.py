"""Product Knowledge Graph — index and query evidence across all sources.

Uses ChromaDB for vector storage with semantic search, plus an in-memory
evidence store for structured access.
"""

from __future__ import annotations

from pathlib import Path

import chromadb
from chromadb.config import Settings

from compass.models.sources import Evidence, EvidenceStore, SourceType


class KnowledgeGraph:
    """Stores and queries product evidence across all four sources of truth."""

    def __init__(self, persist_dir: Path | None = None):
        if persist_dir:
            persist_dir.mkdir(parents=True, exist_ok=True)
            self._client = chromadb.PersistentClient(
                path=str(persist_dir),
                settings=Settings(anonymized_telemetry=False),
            )
        else:
            self._client = chromadb.EphemeralClient(
                settings=Settings(anonymized_telemetry=False),
            )

        self._collection = self._client.get_or_create_collection(
            name="product_evidence",
            metadata={"hnsw:space": "cosine"},
        )
        self._store = EvidenceStore()

    @property
    def store(self) -> EvidenceStore:
        return self._store

    def add(self, evidence: Evidence) -> None:
        """Add a single piece of evidence to the knowledge graph."""
        self._store.add(evidence)
        self._collection.add(
            ids=[evidence.id],
            documents=[evidence.content],
            metadatas=[{
                "source_type": evidence.source_type.value,
                "connector": evidence.connector,
                "title": evidence.title,
            }],
        )

    def add_many(self, items: list[Evidence]) -> None:
        """Add multiple evidence items."""
        if not items:
            return
        self._store.add_many(items)
        self._collection.add(
            ids=[e.id for e in items],
            documents=[e.content for e in items],
            metadatas=[{
                "source_type": e.source_type.value,
                "connector": e.connector,
                "title": e.title,
            } for e in items],
        )

    def query(self, query: str, n_results: int = 10, source_type: SourceType | None = None) -> list[Evidence]:
        """Semantic search across all evidence."""
        where = {"source_type": source_type.value} if source_type else None

        try:
            results = self._collection.query(
                query_texts=[query],
                n_results=min(n_results, len(self._store)),
                where=where,
            )
        except Exception:
            return []

        if not results["ids"] or not results["ids"][0]:
            return []

        matched_ids = set(results["ids"][0])
        return [e for e in self._store.items if e.id in matched_ids]

    def get_cross_source_evidence(self, query: str, n_per_source: int = 5) -> dict[SourceType, list[Evidence]]:
        """Get related evidence from each source type for a given query."""
        result: dict[SourceType, list[Evidence]] = {}
        for source_type in SourceType:
            evidence = self.query(query, n_results=n_per_source, source_type=source_type)
            if evidence:
                result[source_type] = evidence
        return result

    def clear(self) -> None:
        """Clear all evidence."""
        self._client.delete_collection("product_evidence")
        self._collection = self._client.get_or_create_collection(
            name="product_evidence",
            metadata={"hnsw:space": "cosine"},
        )
        self._store = EvidenceStore()

    def __len__(self) -> int:
        return len(self._store)
