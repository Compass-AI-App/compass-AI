"""Zendesk connector — part of the JUDGMENT source of truth.

Ingests: Zendesk ticket exports (JSON or CSV format).
Answers: "What are customers STRUGGLING with?"

Supports:
- Zendesk JSON export
- Zendesk CSV export
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

from compass.connectors.base import Connector
from compass.models.sources import Evidence, SourceType

MAX_TICKETS = 500


class ZendeskConnector(Connector):
    """Ingests tickets from Zendesk exports."""

    connector_type = "zendesk"

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
            if p.suffix.lower() == ".json":
                evidence.extend(self._ingest_json(p))
            elif p.suffix.lower() == ".csv":
                evidence.extend(self._ingest_csv(p))
        elif p.is_dir():
            for fpath in sorted(p.rglob("*.json"))[:20]:
                evidence.extend(self._ingest_json(fpath))
            for fpath in sorted(p.rglob("*.csv"))[:20]:
                evidence.extend(self._ingest_csv(fpath))

        return evidence

    def _ingest_json(self, fpath: Path) -> list[Evidence]:
        try:
            data = json.loads(fpath.read_text(errors="ignore"))
        except (json.JSONDecodeError, OSError):
            return []

        tickets = []
        if isinstance(data, list):
            tickets = data
        elif isinstance(data, dict):
            tickets = data.get("tickets", data.get("results", []))

        if not tickets:
            return []

        evidence: list[Evidence] = []

        # Summary
        summary_lines = []
        for ticket in tickets[:MAX_TICKETS]:
            subject = ticket.get("subject", ticket.get("title", ""))
            status = ticket.get("status", "")
            priority = ticket.get("priority", "")
            tags = ticket.get("tags", [])
            tag_str = f" [{', '.join(tags[:3])}]" if tags else ""
            summary_lines.append(f"- [{status}] {subject}{tag_str}")

        evidence.append(Evidence(
            source_type=SourceType.JUDGMENT,
            connector="zendesk",
            title=f"Zendesk tickets: {fpath.stem} ({len(tickets)} tickets)",
            content=(
                f"Zendesk tickets from {fpath.name}: {len(tickets)} total\n\n"
                + "\n".join(summary_lines)
            ),
            metadata={
                "file": str(fpath),
                "type": "zendesk_export",
                "ticket_count": len(tickets),
            },
        ))

        # Per-ticket for tickets with descriptions
        for ticket in tickets[:MAX_TICKETS]:
            description = ticket.get("description", "")
            if not description or len(description) < 50:
                continue

            subject = ticket.get("subject", ticket.get("title", ""))
            status = ticket.get("status", "")
            priority = ticket.get("priority", "")

            comments = ticket.get("comments", [])
            comment_text = ""
            if comments:
                comment_text = "\n\n**Comments:**\n" + "\n".join(
                    f"- {c.get('author', 'unknown')}: {c.get('body', '')[:300]}"
                    for c in comments[:5]
                )

            evidence.append(Evidence(
                source_type=SourceType.JUDGMENT,
                connector="zendesk",
                title=f"Zendesk: {subject}",
                content=f"**{subject}**\nStatus: {status}\nPriority: {priority}\n\n{description[:5000]}{comment_text}",
                metadata={
                    "type": "zendesk_ticket",
                    "status": status,
                    "priority": priority,
                },
            ))

        # Tag distribution
        tag_counts: dict[str, int] = {}
        for ticket in tickets:
            for tag in ticket.get("tags", []):
                tag_counts[tag] = tag_counts.get(tag, 0) + 1

        if tag_counts:
            dist_lines = ["**Tag distribution:**"]
            for tag, count in sorted(tag_counts.items(), key=lambda x: -x[1])[:20]:
                dist_lines.append(f"- {tag}: {count}")

            evidence.append(Evidence(
                source_type=SourceType.JUDGMENT,
                connector="zendesk",
                title=f"Zendesk tags: {len(tag_counts)} unique tags across {len(tickets)} tickets",
                content="\n".join(dist_lines),
                metadata={"type": "zendesk_distribution"},
            ))

        return evidence

    def _ingest_csv(self, fpath: Path) -> list[Evidence]:
        try:
            with open(fpath, newline="", errors="ignore") as f:
                reader = csv.DictReader(f)
                rows = list(reader)
        except (OSError, csv.Error):
            return []

        if not rows:
            return []

        # Build a case-insensitive header mapping: lowered_name → original_name
        original_headers = list(rows[0].keys())
        header_map = {h.lower(): h for h in original_headers}
        lowered = list(header_map.keys())

        subject_col = self._find_col(lowered, ["subject", "title", "summary"])
        status_col = self._find_col(lowered, ["status", "state"])

        # Resolve back to original header names for dict access
        subject_key = header_map[subject_col] if subject_col else None
        status_key = header_map[status_col] if status_col else None

        summary_lines = []
        for row in rows[:MAX_TICKETS]:
            subject = row.get(subject_key, "Ticket") if subject_key else "Ticket"
            status = row.get(status_key, "") if status_key else ""
            status_str = f" [{status}]" if status else ""
            summary_lines.append(f"- {subject}{status_str}")

        return [Evidence(
            source_type=SourceType.JUDGMENT,
            connector="zendesk",
            title=f"Zendesk CSV: {fpath.stem} ({len(rows)} tickets)",
            content=f"Zendesk tickets: {len(rows)} total\n\n" + "\n".join(summary_lines),
            metadata={
                "file": str(fpath),
                "type": "zendesk_csv",
                "ticket_count": len(rows),
            },
        )]

    def _find_col(self, headers: list[str], candidates: list[str]) -> str | None:
        for c in candidates:
            if c in headers:
                return c
        return None
