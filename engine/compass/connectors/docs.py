"""Documents connector — the DOCS source of truth.

Ingests: Strategy docs, PRDs, roadmaps, design docs (markdown, text).
Answers: "What's EXPECTED to happen?"
"""

from __future__ import annotations

from pathlib import Path

from compass.connectors.base import Connector
from compass.models.sources import Evidence, SourceType

DOC_EXTENSIONS = {".md", ".txt", ".rst", ".html", ".doc", ".docx"}
MAX_DOC_SIZE = 30_000


class DocsConnector(Connector):
    """Ingests strategy documents, specs, and plans."""

    connector_type = "docs"

    def validate(self) -> bool:
        path = self.config.path
        if not path:
            return False
        p = Path(path).expanduser()
        return p.exists()

    def ingest(self) -> list[Evidence]:
        path = self.config.path
        if not path:
            return []

        p = Path(path).expanduser().resolve()
        evidence: list[Evidence] = []

        if p.is_file():
            ev = self._ingest_file(p)
            if ev:
                evidence.append(ev)
        elif p.is_dir():
            for fpath in sorted(p.rglob("*")):
                if fpath.is_file() and fpath.suffix.lower() in DOC_EXTENSIONS:
                    ev = self._ingest_file(fpath)
                    if ev:
                        evidence.append(ev)

        return evidence

    def _ingest_file(self, fpath: Path) -> Evidence | None:
        try:
            content = fpath.read_text(errors="ignore")
            if not content.strip():
                return None
            if len(content) > MAX_DOC_SIZE:
                content = content[:MAX_DOC_SIZE] + "\n... (truncated)"

            title = self._extract_title(content, fpath)
            return Evidence(
                source_type=SourceType.DOCS,
                connector="docs",
                title=title,
                content=content,
                metadata={"file": str(fpath), "type": fpath.suffix},
            )
        except Exception:
            return None

    def _extract_title(self, content: str, fpath: Path) -> str:
        for line in content.split("\n")[:5]:
            line = line.strip()
            if line.startswith("# "):
                return line[2:].strip()
        return fpath.stem.replace("-", " ").replace("_", " ").title()
