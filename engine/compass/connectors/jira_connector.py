"""Jira connector — part of the JUDGMENT source of truth.

Ingests: Jira issues from JSON export files.
Answers: "What is the team PLANNING and TRACKING?"

Supports:
- Jira Cloud JSON export (from Jira's built-in export)
- Directory of JSON files
"""

from __future__ import annotations

import json
from pathlib import Path

from compass.connectors.base import Connector
from compass.models.sources import Evidence, SourceType

MAX_ISSUES = 500


class JiraConnector(Connector):
    """Ingests Jira issues from JSON export files."""

    connector_type = "jira"

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

        if p.is_file() and p.suffix.lower() == ".json":
            evidence.extend(self._ingest_json(p))
        elif p.is_dir():
            for fpath in sorted(p.rglob("*.json")):
                evidence.extend(self._ingest_json(fpath))

        return evidence

    def _ingest_json(self, fpath: Path) -> list[Evidence]:
        try:
            data = json.loads(fpath.read_text(errors="ignore"))
        except (json.JSONDecodeError, OSError):
            return []

        issues = self._extract_issues(data)
        if not issues:
            return []

        evidence: list[Evidence] = []

        # Summary evidence item
        summary_lines = []
        for issue in issues[:MAX_ISSUES]:
            key = issue.get("key", "")
            summary = issue.get("summary", "")
            status = issue.get("status", "")
            priority = issue.get("priority", "")
            prefix = f"[{key}]" if key else ""
            status_str = f" ({status})" if status else ""
            priority_str = f" [{priority}]" if priority else ""
            summary_lines.append(f"- {prefix}{priority_str} {summary}{status_str}")

        evidence.append(Evidence(
            source_type=SourceType.JUDGMENT,
            connector="jira",
            title=f"Jira issues: {fpath.stem} ({len(issues)} issues)",
            content=(
                f"Jira issues from {fpath.name}: {len(issues)} total\n\n"
                + "\n".join(summary_lines)
            ),
            metadata={
                "file": str(fpath),
                "type": "jira_export",
                "issue_count": len(issues),
            },
        ))

        # Per-issue evidence for issues with substantial descriptions
        for issue in issues[:MAX_ISSUES]:
            description = issue.get("description", "")
            if not description or len(description) < 50:
                continue

            key = issue.get("key", "")
            summary = issue.get("summary", "")
            status = issue.get("status", "")
            priority = issue.get("priority", "")
            comments = issue.get("comments", [])

            content_parts = [
                f"**{key}: {summary}**",
                f"Status: {status}" if status else "",
                f"Priority: {priority}" if priority else "",
                "",
                description[:5000],
            ]

            if comments:
                content_parts.append("\n**Comments:**")
                for comment in comments[:10]:
                    author = comment.get("author", "unknown")
                    body = comment.get("body", "")[:500]
                    content_parts.append(f"- {author}: {body}")

            evidence.append(Evidence(
                source_type=SourceType.JUDGMENT,
                connector="jira",
                title=f"Jira: {key} — {summary}" if key else f"Jira: {summary}",
                content="\n".join(content_parts),
                metadata={
                    "type": "jira_issue",
                    "key": key,
                    "status": status,
                    "priority": priority,
                },
            ))

        # Status distribution evidence
        status_counts: dict[str, int] = {}
        priority_counts: dict[str, int] = {}
        for issue in issues:
            s = issue.get("status", "unknown")
            p = issue.get("priority", "unknown")
            status_counts[s] = status_counts.get(s, 0) + 1
            priority_counts[p] = priority_counts.get(p, 0) + 1

        dist_lines = ["**Status distribution:**"]
        for s, c in sorted(status_counts.items(), key=lambda x: -x[1]):
            dist_lines.append(f"- {s}: {c}")
        dist_lines.append("\n**Priority distribution:**")
        for p, c in sorted(priority_counts.items(), key=lambda x: -x[1]):
            dist_lines.append(f"- {p}: {c}")

        evidence.append(Evidence(
            source_type=SourceType.JUDGMENT,
            connector="jira",
            title=f"Jira distribution: {len(issues)} issues across {len(status_counts)} statuses",
            content="\n".join(dist_lines),
            metadata={"type": "jira_distribution"},
        ))

        return evidence

    def _extract_issues(self, data: object) -> list[dict]:
        """Extract issue dicts from various Jira export formats."""
        if isinstance(data, list):
            return [self._normalize_issue(item) for item in data if isinstance(item, dict)]

        if isinstance(data, dict):
            # Jira Cloud export format: {"issues": [...]}
            if "issues" in data:
                return [self._normalize_issue(item) for item in data["issues"] if isinstance(item, dict)]
            # Single issue
            return [self._normalize_issue(data)]

        return []

    def _normalize_issue(self, raw: dict) -> dict:
        """Normalize a Jira issue dict into a consistent format."""
        # Handle nested fields format (Jira Cloud API)
        fields = raw.get("fields", {})
        if fields and isinstance(fields, dict):
            comments_raw = fields.get("comment", {})
            comments = []
            if isinstance(comments_raw, dict):
                for c in comments_raw.get("comments", []):
                    author_data = c.get("author", {})
                    comments.append({
                        "author": author_data.get("displayName", "unknown") if isinstance(author_data, dict) else "unknown",
                        "body": c.get("body", ""),
                    })

            status_data = fields.get("status", {})
            priority_data = fields.get("priority", {})

            return {
                "key": raw.get("key", ""),
                "summary": fields.get("summary", ""),
                "description": fields.get("description", ""),
                "status": status_data.get("name", "") if isinstance(status_data, dict) else str(status_data),
                "priority": priority_data.get("name", "") if isinstance(priority_data, dict) else str(priority_data),
                "comments": comments,
            }

        # Flat format (simple export)
        return {
            "key": raw.get("key", raw.get("id", "")),
            "summary": raw.get("summary", raw.get("title", "")),
            "description": raw.get("description", raw.get("body", "")),
            "status": raw.get("status", ""),
            "priority": raw.get("priority", ""),
            "comments": raw.get("comments", []),
        }
