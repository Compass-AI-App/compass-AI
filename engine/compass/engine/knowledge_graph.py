"""Product Knowledge Graph — index and query evidence across all sources.

Uses ChromaDB for vector storage with semantic search, plus an in-memory
evidence store for structured access. The evidence store is persisted to
disk as evidence_store.json alongside ChromaDB's vector data.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import chromadb
from chromadb.config import Settings

from compass.models.sources import Evidence, EvidenceStore, SourceType


class KnowledgeGraph:
    """Stores and queries product evidence across all four sources of truth."""

    STORE_FILE = "evidence_store.json"

    def __init__(self, persist_dir: Path | None = None):
        self._persist_dir = persist_dir

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

        # Load persisted evidence store if it exists
        self._load_store()

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
        self._save_store()

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
        self._save_store()

    def query(self, query: str, n_results: int = 10, source_type: SourceType | None = None) -> list[Evidence]:
        """Semantic search across all evidence."""
        if len(self._store) == 0:
            return []

        where = {"source_type": source_type.value} if source_type else None
        effective_n = min(n_results, len(self._store))
        if effective_n <= 0:
            return []

        try:
            results = self._collection.query(
                query_texts=[query],
                n_results=effective_n,
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

        # Delete persisted evidence store
        if self._persist_dir:
            store_path = self._persist_dir / self.STORE_FILE
            if store_path.exists():
                store_path.unlink()

    def _save_store(self) -> None:
        """Serialize the evidence store to disk."""
        if not self._persist_dir:
            return
        store_path = self._persist_dir / self.STORE_FILE
        data = [self._evidence_to_dict(e) for e in self._store.items]
        store_path.write_text(json.dumps(data, indent=2, default=str))

    def _load_store(self) -> None:
        """Load the evidence store from disk if it exists."""
        if not self._persist_dir:
            return
        store_path = self._persist_dir / self.STORE_FILE
        if not store_path.exists():
            return
        try:
            data = json.loads(store_path.read_text())
            items = [self._dict_to_evidence(d) for d in data]
            self._store = EvidenceStore(items=items)
        except Exception:
            # If the file is corrupted, start fresh
            pass

    @staticmethod
    def _evidence_to_dict(e: Evidence) -> dict:
        """Convert Evidence to a JSON-serializable dict."""
        return {
            "id": e.id,
            "source_type": e.source_type.value,
            "connector": e.connector,
            "title": e.title,
            "content": e.content,
            "metadata": e.metadata,
            "timestamp": e.timestamp.isoformat() if isinstance(e.timestamp, datetime) else str(e.timestamp),
        }

    @staticmethod
    def _dict_to_evidence(d: dict) -> Evidence:
        """Reconstruct Evidence from a dict."""
        timestamp = d.get("timestamp")
        if isinstance(timestamp, str):
            try:
                timestamp = datetime.fromisoformat(timestamp)
            except (ValueError, TypeError):
                timestamp = datetime.now()
        return Evidence(
            id=d["id"],
            source_type=SourceType(d["source_type"]),
            connector=d["connector"],
            title=d["title"],
            content=d["content"],
            metadata=d.get("metadata", {}),
            timestamp=timestamp or datetime.now(),
        )

    def __len__(self) -> int:
        return len(self._store)
