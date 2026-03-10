"""Linear connector — part of the JUDGMENT source of truth.

Ingests: Linear issues from JSON export files.
Answers: "What is the team PLANNING and TRACKING?"

Supports:
- Linear JSON export (from Linear's export feature)
- Directory of JSON files
"""

from __future__ import annotations

import json
from pathlib import Path

from compass.connectors.base import Connector
from compass.models.sources import Evidence, SourceType

MAX_ISSUES = 500


class LinearConnector(Connector):
    """Ingests Linear issues from JSON export files."""

    connector_type = "linear"

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

        # Summary evidence
        summary_lines = []
        for issue in issues[:MAX_ISSUES]:
            identifier = issue.get("identifier", "")
            title = issue.get("title", "")
            state = issue.get("state", "")
            priority_label = issue.get("priority_label", "")
            prefix = f"[{identifier}]" if identifier else ""
            state_str = f" ({state})" if state else ""
            prio_str = f" [{priority_label}]" if priority_label else ""
            summary_lines.append(f"- {prefix}{prio_str} {title}{state_str}")

        evidence.append(Evidence(
            source_type=SourceType.JUDGMENT,
            connector="linear",
            title=f"Linear issues: {fpath.stem} ({len(issues)} issues)",
            content=(
                f"Linear issues from {fpath.name}: {len(issues)} total\n\n"
                + "\n".join(summary_lines)
            ),
            metadata={
                "file": str(fpath),
                "type": "linear_export",
                "issue_count": len(issues),
            },
        ))

        # Per-issue evidence for issues with descriptions
        for issue in issues[:MAX_ISSUES]:
            description = issue.get("description", "")
            if not description or len(description) < 50:
                continue

            identifier = issue.get("identifier", "")
            title = issue.get("title", "")
            state = issue.get("state", "")
            priority_label = issue.get("priority_label", "")
            labels = issue.get("labels", [])
            comments = issue.get("comments", [])

            content_parts = [
                f"**{identifier}: {title}**" if identifier else f"**{title}**",
                f"State: {state}" if state else "",
                f"Priority: {priority_label}" if priority_label else "",
                f"Labels: {', '.join(labels)}" if labels else "",
                "",
                description[:5000],
            ]

            if comments:
                content_parts.append("\n**Comments:**")
                for comment in comments[:10]:
                    user = comment.get("user", "unknown")
                    body = comment.get("body", "")[:500]
                    content_parts.append(f"- {user}: {body}")

            evidence.append(Evidence(
                source_type=SourceType.JUDGMENT,
                connector="linear",
                title=f"Linear: {identifier} — {title}" if identifier else f"Linear: {title}",
                content="\n".join(p for p in content_parts if p is not None),
                metadata={
                    "type": "linear_issue",
                    "identifier": identifier,
                    "state": state,
                    "priority": priority_label,
                },
            ))

        # State distribution
        state_counts: dict[str, int] = {}
        for issue in issues:
            s = issue.get("state", "unknown")
            state_counts[s] = state_counts.get(s, 0) + 1

        dist_lines = ["**State distribution:**"]
        for s, c in sorted(state_counts.items(), key=lambda x: -x[1]):
            dist_lines.append(f"- {s}: {c}")

        evidence.append(Evidence(
            source_type=SourceType.JUDGMENT,
            connector="linear",
            title=f"Linear distribution: {len(issues)} issues across {len(state_counts)} states",
            content="\n".join(dist_lines),
            metadata={"type": "linear_distribution"},
        ))

        return evidence

    def _extract_issues(self, data: object) -> list[dict]:
        """Extract issue dicts from various Linear export formats."""
        if isinstance(data, list):
            return [self._normalize(item) for item in data if isinstance(item, dict)]

        if isinstance(data, dict):
            # Linear export: {"issues": [...]} or {"data": {"issues": {"nodes": [...]}}}
            if "issues" in data:
                issues_data = data["issues"]
                if isinstance(issues_data, list):
                    return [self._normalize(item) for item in issues_data]
                if isinstance(issues_data, dict) and "nodes" in issues_data:
                    return [self._normalize(item) for item in issues_data["nodes"]]

            if "data" in data and isinstance(data["data"], dict):
                return self._extract_issues(data["data"])

            # Single issue
            if "title" in data:
                return [self._normalize(data)]

        return []

    def _normalize(self, raw: dict) -> dict:
        """Normalize a Linear issue dict."""
        state = raw.get("state", {})
        state_name = state.get("name", "") if isinstance(state, dict) else str(state)

        labels_raw = raw.get("labels", {})
        labels = []
        if isinstance(labels_raw, dict) and "nodes" in labels_raw:
            labels = [l.get("name", "") for l in labels_raw["nodes"] if isinstance(l, dict)]
        elif isinstance(labels_raw, list):
            labels = [l.get("name", l) if isinstance(l, dict) else str(l) for l in labels_raw]

        comments_raw = raw.get("comments", {})
        comments = []
        if isinstance(comments_raw, dict) and "nodes" in comments_raw:
            for c in comments_raw["nodes"]:
                if isinstance(c, dict):
                    user_data = c.get("user", {})
                    comments.append({
                        "user": user_data.get("name", "unknown") if isinstance(user_data, dict) else "unknown",
                        "body": c.get("body", ""),
                    })
        elif isinstance(comments_raw, list):
            for c in comments_raw:
                if isinstance(c, dict):
                    comments.append({
                        "user": c.get("user", "unknown"),
                        "body": c.get("body", ""),
                    })

        return {
            "identifier": raw.get("identifier", ""),
            "title": raw.get("title", ""),
            "description": raw.get("description", ""),
            "state": state_name,
            "priority_label": raw.get("priorityLabel", raw.get("priority_label", "")),
            "labels": labels,
            "comments": comments,
        }
