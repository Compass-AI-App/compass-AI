"""Git utilities for Compass workspaces.

Auto-creates git repositories for new projects with appropriate .gitignore.
"""

from __future__ import annotations

import logging
from pathlib import Path

logger = logging.getLogger(__name__)

GITIGNORE_CONTENT = """\
# Compass internal data (embeddings, vector DB)
.compass/knowledge/

# Encrypted files
*.enc

# Python
__pycache__/
*.pyc
.venv/

# OS
.DS_Store
Thumbs.db

# Environment
.env
.env.local
"""


def init_git_repo(workspace_path: Path) -> bool:
    """Initialize a git repo in the workspace if not already one.

    Creates .gitignore and makes an initial commit with compass.yaml.
    Returns True if a new repo was created, False if one already existed.
    """
    try:
        from git import Repo, InvalidGitRepositoryError
    except ImportError:
        logger.warning("gitpython not installed, skipping git init")
        return False

    # Check if already a git repo
    try:
        Repo(workspace_path)
        logger.debug("Workspace %s is already a git repo", workspace_path)
        return False
    except InvalidGitRepositoryError:
        pass

    try:
        repo = Repo.init(workspace_path)

        # Write .gitignore
        gitignore_path = workspace_path / ".gitignore"
        if not gitignore_path.exists():
            gitignore_path.write_text(GITIGNORE_CONTENT)

        # Stage compass.yaml and .gitignore
        files_to_add = [".gitignore"]
        if (workspace_path / "compass.yaml").exists():
            files_to_add.append("compass.yaml")

        repo.index.add(files_to_add)
        repo.index.commit("Initial commit — Compass workspace")

        logger.info("Initialized git repo at %s", workspace_path)
        return True
    except Exception as e:
        logger.warning("Failed to initialize git repo at %s: %s", workspace_path, e)
        return False
