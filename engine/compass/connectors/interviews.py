"""Interview transcript connector — part of the JUDGMENT source of truth.

Ingests: Interview transcripts, user research notes, feedback summaries.
Answers: "What do users WANT?"
"""

from __future__ import annotations

from pathlib import Path

from compass.connectors.base import Connector
from compass.models.sources import Evidence, SourceType

TRANSCRIPT_EXTENSIONS = {".md", ".txt", ".rst"}
MAX_TRANSCRIPT_SIZE = 20_000


class InterviewConnector(Connector):
    """Ingests interview transcripts and user research."""

    connector_type = "interviews"

    def validate(self) -> bool:
        path = self.config.path
        if not path:
            return False
        return Path(path).expanduser().exists()

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
                if fpath.is_file() and fpath.suffix.lower() in TRANSCRIPT_EXTENSIONS:
                    ev = self._ingest_file(fpath)
                    if ev:
                        evidence.append(ev)

        return evidence

    def _ingest_file(self, fpath: Path) -> Evidence | None:
        try:
            content = fpath.read_text(errors="ignore")
            if not content.strip():
                return None
            if len(content) > MAX_TRANSCRIPT_SIZE:
                content = content[:MAX_TRANSCRIPT_SIZE] + "\n... (truncated)"

            title = self._extract_title(content, fpath)
            return Evidence(
                source_type=SourceType.JUDGMENT,
                connector="interviews",
                title=title,
                content=content,
                metadata={"file": str(fpath), "type": "interview"},
            )
        except Exception:
            return None

    def _extract_title(self, content: str, fpath: Path) -> str:
        for line in content.split("\n")[:5]:
            line = line.strip()
            if line.startswith("# "):
                return f"Interview: {line[2:].strip()}"
        return f"Interview: {fpath.stem.replace('-', ' ').replace('_', ' ').title()}"
