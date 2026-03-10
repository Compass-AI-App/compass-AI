"""Confluence connector — part of the DOCS source of truth.

Ingests: Confluence space exports (HTML or XML format).
Answers: "What is DOCUMENTED?"

Supports:
- Confluence HTML export directories
- Confluence XML export (site export)
"""

from __future__ import annotations

import re
from pathlib import Path

from compass.connectors.base import Connector
from compass.models.sources import Evidence, SourceType

MAX_PAGES = 300


class ConfluenceConnector(Connector):
    """Ingests pages from Confluence HTML/XML exports."""

    connector_type = "confluence"

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

        if p.is_dir():
            # HTML export
            html_files = sorted(p.rglob("*.html"))[:MAX_PAGES]
            for fpath in html_files:
                ev = self._ingest_html(fpath)
                if ev:
                    evidence.append(ev)

            # Also check for markdown (some exports convert to md)
            md_files = sorted(p.rglob("*.md"))[:MAX_PAGES]
            for fpath in md_files:
                ev = self._ingest_markdown(fpath)
                if ev:
                    evidence.append(ev)

        return evidence

    def _ingest_html(self, fpath: Path) -> Evidence | None:
        try:
            content = fpath.read_text(errors="ignore")
        except OSError:
            return None

        if not content.strip():
            return None

        # Strip HTML tags
        text = re.sub(r"<script[^>]*>.*?</script>", "", content, flags=re.DOTALL)
        text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL)
        text = re.sub(r"<[^>]+>", " ", text)
        text = re.sub(r"\s+", " ", text).strip()

        if len(text) < 50:
            return None

        title = self._extract_title(content, fpath.stem)

        return Evidence(
            source_type=SourceType.DOCS,
            connector="confluence",
            title=f"Confluence: {title}",
            content=text[:15_000],
            metadata={
                "file": str(fpath),
                "type": "confluence_page",
            },
        )

    def _ingest_markdown(self, fpath: Path) -> Evidence | None:
        try:
            content = fpath.read_text(errors="ignore")
        except OSError:
            return None

        if not content.strip() or len(content.strip()) < 50:
            return None

        title = fpath.stem.replace("-", " ").replace("_", " ").title()

        return Evidence(
            source_type=SourceType.DOCS,
            connector="confluence",
            title=f"Confluence: {title}",
            content=content[:15_000],
            metadata={
                "file": str(fpath),
                "type": "confluence_page",
            },
        )

    def _extract_title(self, html: str, fallback: str) -> str:
        """Extract page title from HTML."""
        match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
        if match:
            title = re.sub(r"<[^>]+>", "", match.group(1)).strip()
            if title:
                return title
        return fallback.replace("-", " ").replace("_", " ").title()
