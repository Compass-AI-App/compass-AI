"""Notion connector — part of the DOCS source of truth.

Ingests: Notion markdown exports (from Notion's export feature).
Answers: "What is DOCUMENTED and DECIDED?"

Supports:
- Notion markdown export directory (nested folders with .md files)
- Notion CSV database exports
"""

from __future__ import annotations

import csv
from pathlib import Path

from compass.connectors.base import Connector
from compass.models.sources import Evidence, SourceType

MAX_PAGES = 200


class NotionConnector(Connector):
    """Ingests pages from Notion markdown export directories."""

    connector_type = "notion"

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
            if p.suffix.lower() == ".md":
                ev = self._ingest_markdown(p)
                if ev:
                    evidence.append(ev)
            elif p.suffix.lower() == ".csv":
                evidence.extend(self._ingest_csv(p))
        elif p.is_dir():
            # Collect all markdown files (Notion exports nested directories)
            md_files = sorted(p.rglob("*.md"))[:MAX_PAGES]
            for fpath in md_files:
                ev = self._ingest_markdown(fpath)
                if ev:
                    evidence.append(ev)

            # Also check for CSV database exports
            for fpath in sorted(p.rglob("*.csv"))[:20]:
                evidence.extend(self._ingest_csv(fpath))

        return evidence

    def _ingest_markdown(self, fpath: Path) -> Evidence | None:
        try:
            content = fpath.read_text(errors="ignore")
        except OSError:
            return None

        if not content.strip():
            return None

        # Notion exports include a hash suffix in filenames: "Page Title abc123.md"
        # Clean it up for the title
        title = self._clean_notion_title(fpath.stem)

        return Evidence(
            source_type=SourceType.DOCS,
            connector="notion",
            title=f"Notion: {title}",
            content=content[:15_000],
            metadata={
                "file": str(fpath),
                "type": "notion_page",
            },
        )

    def _ingest_csv(self, fpath: Path) -> list[Evidence]:
        """Ingest a Notion database CSV export."""
        try:
            with open(fpath, newline="", errors="ignore") as f:
                reader = csv.DictReader(f)
                rows = list(reader)
        except (OSError, csv.Error):
            return []

        if not rows:
            return []

        # Create a summary of the database
        headers = list(rows[0].keys())
        name_col = self._find_column(headers, ["name", "title", "page", "task"])

        summary_lines = []
        for row in rows[:MAX_PAGES]:
            if name_col:
                name = row.get(name_col, "")
                other = " | ".join(
                    f"{k}: {v}" for k, v in row.items()
                    if k != name_col and v and len(v) < 200
                )
                summary_lines.append(f"- **{name}**: {other[:300]}")
            else:
                summary_lines.append("- " + " | ".join(f"{k}: {v}" for k, v in row.items() if v)[:300])

        db_title = self._clean_notion_title(fpath.stem)

        return [Evidence(
            source_type=SourceType.DOCS,
            connector="notion",
            title=f"Notion DB: {db_title} ({len(rows)} rows)",
            content=(
                f"Notion database: {db_title}\nColumns: {', '.join(headers)}\n"
                f"Rows: {len(rows)}\n\n"
                + "\n".join(summary_lines)
            ),
            metadata={
                "file": str(fpath),
                "type": "notion_database",
                "row_count": len(rows),
                "columns": headers,
            },
        )]

    def _clean_notion_title(self, stem: str) -> str:
        """Remove Notion's hash suffix from page titles.

        Notion exports files like 'My Page Title abc123def456.md'.
        The hash is a 32-char hex string at the end after a space.
        """
        parts = stem.rsplit(" ", 1)
        if len(parts) == 2 and len(parts[1]) == 32:
            try:
                int(parts[1], 16)
                return parts[0]
            except ValueError:
                pass
        return stem.replace("-", " ").replace("_", " ")

    def _find_column(self, headers: list[str], candidates: list[str]) -> str | None:
        headers_lower = [h.lower() for h in headers]
        for candidate in candidates:
            if candidate in headers_lower:
                idx = headers_lower.index(candidate)
                return headers[idx]
        return None
