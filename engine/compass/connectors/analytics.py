"""Analytics connector — the DATA source of truth.

Ingests: CSV/JSON usage data, metrics exports, analytics summaries.
Answers: "What IS happening?"
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

from compass.connectors.base import Connector
from compass.models.sources import Evidence, SourceType

MAX_ROWS = 500


class AnalyticsConnector(Connector):
    """Ingests analytics and usage data."""

    connector_type = "analytics"

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
                evidence.extend(ev)
        elif p.is_dir():
            for fpath in sorted(p.rglob("*")):
                if fpath.is_file() and fpath.suffix.lower() in {".csv", ".json", ".jsonl"}:
                    ev = self._ingest_file(fpath)
                    if ev:
                        evidence.extend(ev)

        return evidence

    def _ingest_file(self, fpath: Path) -> list[Evidence]:
        suffix = fpath.suffix.lower()
        if suffix == ".csv":
            return self._ingest_csv(fpath)
        elif suffix in {".json", ".jsonl"}:
            return self._ingest_json(fpath)
        return []

    def _ingest_csv(self, fpath: Path) -> list[Evidence]:
        try:
            with open(fpath, newline="", errors="ignore") as f:
                reader = csv.DictReader(f)
                rows = []
                for i, row in enumerate(reader):
                    if i >= MAX_ROWS:
                        break
                    rows.append(row)

            if not rows:
                return []

            headers = list(rows[0].keys())
            summary_lines = [f"Dataset: {fpath.name}", f"Columns: {', '.join(headers)}", f"Rows: {len(rows)}"]
            summary_lines.append("")

            for row in rows[:20]:
                summary_lines.append(" | ".join(f"{k}: {v}" for k, v in row.items()))

            if len(rows) > 20:
                summary_lines.append(f"... and {len(rows) - 20} more rows")

            return [Evidence(
                source_type=SourceType.DATA,
                connector="analytics",
                title=f"Analytics: {fpath.stem}",
                content="\n".join(summary_lines),
                metadata={"file": str(fpath), "type": "csv", "rows": len(rows), "columns": headers},
            )]
        except Exception:
            return []

    def _ingest_json(self, fpath: Path) -> list[Evidence]:
        try:
            content = fpath.read_text(errors="ignore")
            data = json.loads(content)

            if isinstance(data, list):
                summary = json.dumps(data[:20], indent=2)
                count = len(data)
            elif isinstance(data, dict):
                summary = json.dumps(data, indent=2)[:5000]
                count = len(data)
            else:
                summary = str(data)[:5000]
                count = 1

            return [Evidence(
                source_type=SourceType.DATA,
                connector="analytics",
                title=f"Analytics: {fpath.stem}",
                content=f"Dataset: {fpath.name}\nRecords: {count}\n\n{summary}",
                metadata={"file": str(fpath), "type": "json", "records": count},
            )]
        except Exception:
            return []
