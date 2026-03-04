"""GitHub / local code connector — the CODE source of truth.

Ingests: README, key source files, recent commits, open issues/PRs.
Answers: "What CAN the product do?"
"""

from __future__ import annotations

from pathlib import Path

from compass.connectors.base import Connector
from compass.models.sources import Evidence, SourceType

RELEVANT_EXTENSIONS = {
    ".py", ".js", ".ts", ".tsx", ".jsx", ".go", ".rs", ".java",
    ".rb", ".swift", ".kt", ".scala", ".md", ".yaml", ".yml",
    ".toml", ".json",
}

SKIP_DIRS = {
    "node_modules", ".git", "__pycache__", ".venv", "venv",
    "dist", "build", ".next", ".cache", "vendor",
}

MAX_FILE_SIZE = 50_000  # chars
MAX_FILES = 50


class GitHubConnector(Connector):
    """Ingests code evidence from a local repo or GitHub."""

    connector_type = "github"

    def validate(self) -> bool:
        path = self.config.path
        if path and Path(path).exists():
            return True
        url = self.config.url
        if url:
            return True  # GitHub API validation would go here
        return False

    def ingest(self) -> list[Evidence]:
        evidence: list[Evidence] = []

        path = self.config.path
        if path:
            repo_path = Path(path).expanduser().resolve()
            if repo_path.exists():
                evidence.extend(self._ingest_local(repo_path))

        return evidence

    def _ingest_local(self, repo_path: Path) -> list[Evidence]:
        evidence: list[Evidence] = []

        readme = self._find_readme(repo_path)
        if readme:
            evidence.append(Evidence(
                source_type=SourceType.CODE,
                connector="github",
                title=f"README: {repo_path.name}",
                content=readme.read_text(errors="ignore")[:MAX_FILE_SIZE],
                metadata={"file": str(readme), "type": "readme"},
            ))

        source_files = self._find_source_files(repo_path)
        for fpath in source_files[:MAX_FILES]:
            try:
                content = fpath.read_text(errors="ignore")
                if len(content) > MAX_FILE_SIZE:
                    content = content[:MAX_FILE_SIZE] + "\n... (truncated)"
                rel = fpath.relative_to(repo_path)
                evidence.append(Evidence(
                    source_type=SourceType.CODE,
                    connector="github",
                    title=f"Source: {rel}",
                    content=content,
                    metadata={
                        "file": str(rel),
                        "type": "source",
                        "extension": fpath.suffix,
                    },
                ))
            except Exception:
                continue

        git_log = self._get_git_log(repo_path)
        if git_log:
            evidence.append(Evidence(
                source_type=SourceType.CODE,
                connector="github",
                title=f"Recent commits: {repo_path.name}",
                content=git_log,
                metadata={"type": "git_log"},
            ))

        return evidence

    def _find_readme(self, repo_path: Path) -> Path | None:
        for name in ["README.md", "README.rst", "README.txt", "README"]:
            p = repo_path / name
            if p.exists():
                return p
        return None

    def _find_source_files(self, repo_path: Path) -> list[Path]:
        files: list[Path] = []
        for fpath in repo_path.rglob("*"):
            if any(skip in fpath.parts for skip in SKIP_DIRS):
                continue
            if fpath.is_file() and fpath.suffix in RELEVANT_EXTENSIONS:
                files.append(fpath)
        files.sort(key=lambda f: f.stat().st_mtime, reverse=True)
        return files

    def _get_git_log(self, repo_path: Path) -> str:
        try:
            import git
            repo = git.Repo(repo_path)
            commits = list(repo.iter_commits(max_count=30))
            lines = []
            for c in commits:
                lines.append(f"- {c.committed_datetime.strftime('%Y-%m-%d')} | {c.summary}")
            return "\n".join(lines)
        except Exception:
            return ""
