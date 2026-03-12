"""Authentication and credential models for live API connectors."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class AuthConfig(BaseModel):
    """Auth configuration for a source connector.

    The credential_ref is a logical key (e.g. "github") that maps to
    credentials stored in the Electron vault. The engine never persists
    raw tokens — they are injected at runtime via POST /credentials/inject.
    """

    method: Literal["oauth", "api_key", "pat"] = "oauth"
    credential_ref: str  # e.g. "github", "atlassian", "slack"
    scopes: list[str] = Field(default_factory=list)


class InjectedCredential(BaseModel):
    """A credential injected at runtime from the Electron vault.

    Held in memory only — never written to disk by the engine.
    """

    provider: str
    access_token: str
    refresh_token: str | None = None
    expires_at: int | None = None  # Unix timestamp (ms)
    metadata: dict[str, str] = Field(default_factory=dict)
