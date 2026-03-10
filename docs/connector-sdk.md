# Building a Compass Connector

This guide walks through building a custom connector for Compass. We'll build a Confluence connector as an example.

## Quick Start

```python
from compass.connectors.sdk import Connector, Evidence, SourceType

class ConfluenceConnector(Connector):
    connector_type = "confluence"

    def validate(self) -> bool:
        """Check that the source is accessible."""
        return bool(self.config.path)

    def ingest(self) -> list[Evidence]:
        """Pull evidence from the source."""
        # Your logic here
        return []
```

## The Connector Interface

Every connector must:

1. **Extend `Connector`** — the base class from `compass.connectors.sdk`
2. **Set `connector_type`** — a unique string identifier (e.g., `"confluence"`, `"amplitude"`)
3. **Implement `validate()`** — returns `True` if the source is accessible
4. **Implement `ingest()`** — returns a list of `Evidence` items

## Evidence Model

Each piece of evidence has:

| Field | Type | Description |
|-------|------|-------------|
| `source_type` | `SourceType` | One of: `CODE`, `DOCS`, `DATA`, `JUDGMENT` |
| `connector` | `str` | Your connector type (e.g., `"confluence"`) |
| `title` | `str` | Human-readable title for this evidence |
| `content` | `str` | The actual content (max ~15k chars recommended) |
| `metadata` | `dict` | Optional structured metadata |

### Source Types

Choose the source type that best describes your evidence:

- **`SourceType.CODE`** — What CAN happen. Source code, configs, infrastructure.
- **`SourceType.DOCS`** — What's EXPECTED. Strategy docs, PRDs, roadmaps.
- **`SourceType.DATA`** — What IS happening. Analytics, metrics, usage data.
- **`SourceType.JUDGMENT`** — What SHOULD happen. Interviews, tickets, team decisions.

## Configuration

Your connector receives a `SourceConfig` with:

- `config.path` — File or directory path (for file-based connectors)
- `config.name` — User-provided name for this source
- `config.type` — The source type string
- `config.connector` — The connector type string

## Registration

Register your connector so Compass can find it:

```python
from compass.connectors import CONNECTORS
from my_package.confluence import ConfluenceConnector

CONNECTORS["confluence"] = ConfluenceConnector
```

After registration, users can:

```bash
compass connect confluence --path /path/to/export
```

## Best Practices

1. **Keep content under 15k characters** per evidence item. Compass embeds each item for semantic search.
2. **Create summary evidence** for collections (e.g., "47 Jira issues across 5 statuses") plus detailed evidence for important individual items.
3. **Use meaningful titles** — they appear in conflict and opportunity reports.
4. **Add metadata** for filtering and debugging, but don't put critical info only in metadata.
5. **Handle errors gracefully** — return an empty list rather than crashing.
6. **Filter noise** — skip bot messages, empty pages, system-generated content.

## Example: Full Confluence Connector

```python
import json
from pathlib import Path
from compass.connectors.sdk import Connector, Evidence, SourceType

class ConfluenceConnector(Connector):
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
        evidence = []

        if p.is_dir():
            for fpath in sorted(p.rglob("*.html"))[:200]:
                ev = self._ingest_page(fpath)
                if ev:
                    evidence.append(ev)

        return evidence

    def _ingest_page(self, fpath: Path) -> Evidence | None:
        try:
            content = fpath.read_text(errors="ignore")
            if not content.strip():
                return None

            # Strip HTML tags (simplified)
            import re
            text = re.sub(r'<[^>]+>', '', content)

            return Evidence(
                source_type=SourceType.DOCS,
                connector="confluence",
                title=f"Confluence: {fpath.stem.replace('-', ' ')}",
                content=text[:15_000],
                metadata={
                    "file": str(fpath),
                    "type": "confluence_page",
                },
            )
        except Exception:
            return None
```

## Testing

```python
from compass.config import SourceConfig

config = SourceConfig(
    name="test-confluence",
    type="docs",
    connector="confluence",
    path="/path/to/test/export",
)

connector = ConfluenceConnector(config)
assert connector.validate()

evidence = connector.ingest()
assert len(evidence) > 0
assert all(e.source_type == SourceType.DOCS for e in evidence)
```
