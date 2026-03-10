"""Discovery history — tracks how opportunities and conflicts evolve over time.

Appends each discovery/reconciliation run to a JSON file so PMs can see:
- "This conflict was first detected 3 months ago"
- How priorities shift over time
- Which opportunities keep appearing vs. which are one-off signals
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from compass.models.conflicts import ConflictReport
from compass.models.specs import Opportunity


HISTORY_FILE = "discovery_history.json"


def _load_history(compass_dir: Path) -> list[dict]:
    """Load history entries from disk."""
    history_path = compass_dir / HISTORY_FILE
    if not history_path.exists():
        return []
    try:
        return json.loads(history_path.read_text())
    except (json.JSONDecodeError, OSError):
        return []


def _save_history(compass_dir: Path, entries: list[dict]) -> None:
    """Save history entries to disk."""
    history_path = compass_dir / HISTORY_FILE
    history_path.write_text(json.dumps(entries, indent=2, default=str))


def record_discovery(
    compass_dir: Path,
    opportunities: list[Opportunity],
    conflict_report: ConflictReport | None = None,
) -> dict:
    """Record a discovery run in history. Returns the new entry."""
    entries = _load_history(compass_dir)

    entry = {
        "timestamp": datetime.now().isoformat(),
        "type": "discovery",
        "opportunity_count": len(opportunities),
        "conflict_count": len(conflict_report.conflicts) if conflict_report else 0,
        "opportunities": [
            {
                "title": opp.title,
                "rank": opp.rank,
                "confidence": opp.confidence.value,
                "description": opp.description[:200],
            }
            for opp in opportunities
        ],
        "conflicts": [
            {
                "title": c.title,
                "severity": c.severity.value,
                "conflict_type": c.conflict_type.description if hasattr(c.conflict_type, 'description') else str(c.conflict_type),
            }
            for c in (conflict_report.conflicts if conflict_report else [])
        ],
    }

    entries.append(entry)
    _save_history(compass_dir, entries)
    return entry


def get_history(compass_dir: Path) -> list[dict]:
    """Get all history entries."""
    return _load_history(compass_dir)


def get_opportunity_timeline(compass_dir: Path, title: str) -> list[dict]:
    """Get the timeline for a specific opportunity across discovery runs."""
    entries = _load_history(compass_dir)
    timeline = []

    for entry in entries:
        if entry.get("type") != "discovery":
            continue
        for opp in entry.get("opportunities", []):
            if opp.get("title", "").lower() == title.lower():
                timeline.append({
                    "timestamp": entry["timestamp"],
                    "rank": opp["rank"],
                    "confidence": opp["confidence"],
                })
                break

    return timeline


def get_conflict_first_seen(compass_dir: Path, title: str) -> str | None:
    """Get when a conflict was first detected."""
    entries = _load_history(compass_dir)

    for entry in entries:
        for conflict in entry.get("conflicts", []):
            if conflict.get("title", "").lower() == title.lower():
                return entry.get("timestamp")

    return None


def get_history_summary(compass_dir: Path) -> dict:
    """Get a summary of discovery history."""
    entries = _load_history(compass_dir)

    if not entries:
        return {"total_runs": 0}

    discovery_runs = [e for e in entries if e.get("type") == "discovery"]

    # Track opportunity frequency
    opp_counts: dict[str, int] = {}
    for entry in discovery_runs:
        for opp in entry.get("opportunities", []):
            title = opp.get("title", "")
            opp_counts[title] = opp_counts.get(title, 0) + 1

    # Track conflict persistence
    conflict_counts: dict[str, int] = {}
    for entry in discovery_runs:
        for conflict in entry.get("conflicts", []):
            title = conflict.get("title", "")
            conflict_counts[title] = conflict_counts.get(title, 0) + 1

    recurring_opps = {k: v for k, v in opp_counts.items() if v >= 2}
    persistent_conflicts = {k: v for k, v in conflict_counts.items() if v >= 2}

    return {
        "total_runs": len(discovery_runs),
        "first_run": discovery_runs[0].get("timestamp") if discovery_runs else None,
        "last_run": discovery_runs[-1].get("timestamp") if discovery_runs else None,
        "recurring_opportunities": recurring_opps,
        "persistent_conflicts": persistent_conflicts,
        "total_unique_opportunities": len(opp_counts),
        "total_unique_conflicts": len(conflict_counts),
    }
