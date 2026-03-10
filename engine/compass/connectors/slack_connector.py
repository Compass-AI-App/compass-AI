"""Slack export connector — part of the JUDGMENT source of truth.

Ingests: Slack export directories (from Slack's built-in export).
Answers: "What is the team DISCUSSING and DECIDING?"

Supports:
- Standard Slack export directory structure: channel_name/YYYY-MM-DD.json
- Filters out bot messages and system messages
- Groups messages into daily conversation summaries
"""

from __future__ import annotations

import json
from pathlib import Path

from compass.connectors.base import Connector
from compass.models.sources import Evidence, SourceType

MAX_CHANNELS = 50
MAX_DAYS_PER_CHANNEL = 30
MIN_MESSAGES_PER_DAY = 3


class SlackConnector(Connector):
    """Ingests conversations from Slack export directories."""

    connector_type = "slack"

    def validate(self) -> bool:
        path = self.config.path
        if not path:
            return False
        p = Path(path).expanduser()
        return p.exists() and p.is_dir()

    def ingest(self) -> list[Evidence]:
        path = self.config.path
        if not path:
            return []

        p = Path(path).expanduser().resolve()
        if not p.is_dir():
            return []

        evidence: list[Evidence] = []

        # Load users lookup if available
        users = self._load_users(p)

        # Find channel directories
        channel_dirs = sorted(
            [d for d in p.iterdir() if d.is_dir() and not d.name.startswith(".")],
            key=lambda d: d.name,
        )[:MAX_CHANNELS]

        for channel_dir in channel_dirs:
            channel_evidence = self._ingest_channel(channel_dir, users)
            evidence.extend(channel_evidence)

        return evidence

    def _load_users(self, export_dir: Path) -> dict[str, str]:
        """Load user ID → display name mapping from users.json."""
        users_file = export_dir / "users.json"
        if not users_file.exists():
            return {}

        try:
            data = json.loads(users_file.read_text(errors="ignore"))
            return {
                u["id"]: u.get("real_name") or u.get("name", u["id"])
                for u in data
                if isinstance(u, dict) and "id" in u
            }
        except (json.JSONDecodeError, OSError):
            return {}

    def _ingest_channel(self, channel_dir: Path, users: dict[str, str]) -> list[Evidence]:
        """Ingest a single channel directory into evidence items."""
        channel_name = channel_dir.name
        day_files = sorted(channel_dir.glob("*.json"))[:MAX_DAYS_PER_CHANNEL]

        if not day_files:
            return []

        evidence: list[Evidence] = []
        all_messages: list[str] = []
        total_count = 0

        for day_file in day_files:
            try:
                messages = json.loads(day_file.read_text(errors="ignore"))
            except (json.JSONDecodeError, OSError):
                continue

            if not isinstance(messages, list):
                continue

            # Filter out bots and system messages
            human_messages = [
                m for m in messages
                if isinstance(m, dict)
                and not m.get("bot_id")
                and not m.get("subtype")
                and m.get("text", "").strip()
            ]

            if len(human_messages) < MIN_MESSAGES_PER_DAY:
                continue

            total_count += len(human_messages)
            date_str = day_file.stem  # e.g., "2024-01-15"

            # Format messages for this day
            day_lines = [f"### {date_str}"]
            for msg in human_messages[:50]:
                user_id = msg.get("user", "unknown")
                user_name = users.get(user_id, user_id)
                text = msg["text"][:500]
                day_lines.append(f"**{user_name}:** {text}")

            day_summary = "\n".join(day_lines)
            all_messages.append(day_summary)

            # Create per-day evidence for substantial conversations
            if len(human_messages) >= 10:
                evidence.append(Evidence(
                    source_type=SourceType.JUDGMENT,
                    connector="slack",
                    title=f"Slack #{channel_name} — {date_str} ({len(human_messages)} messages)",
                    content=day_summary[:10_000],
                    metadata={
                        "type": "slack_conversation",
                        "channel": channel_name,
                        "date": date_str,
                        "message_count": len(human_messages),
                    },
                ))

        # Channel summary evidence
        if all_messages:
            summary_content = (
                f"Slack channel #{channel_name}: {total_count} messages across {len(all_messages)} days\n\n"
                + "\n\n".join(all_messages[:10])
            )
            evidence.insert(0, Evidence(
                source_type=SourceType.JUDGMENT,
                connector="slack",
                title=f"Slack #{channel_name} summary ({total_count} messages)",
                content=summary_content[:15_000],
                metadata={
                    "type": "slack_channel_summary",
                    "channel": channel_name,
                    "total_messages": total_count,
                    "days": len(all_messages),
                },
            ))

        return evidence
