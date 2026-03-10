"""Enterprise scaffolding — SSO stubs, audit logging, organization model.

This module provides the foundation for enterprise features:
- Organization model for multi-team management
- Audit logging for all significant actions
- SSO (SAML/OIDC) stubs for enterprise authentication
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from compass_cloud import auth

router = APIRouter(prefix="/enterprise", tags=["enterprise"])

# In-memory stores
_organizations: dict[str, "Organization"] = {}
_audit_log: list["AuditEntry"] = []


# --- Models ---

class Organization(BaseModel):
    id: str = Field(default_factory=lambda: __import__("uuid").uuid4().hex[:12])
    name: str
    owner_email: str
    members: list[str] = Field(default_factory=list)
    sso_enabled: bool = False
    sso_provider: str = ""  # "saml" or "oidc"
    sso_config: dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.now)


class AuditEntry(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.now)
    org_id: str = ""
    user_email: str
    action: str
    resource_type: str
    resource_id: str = ""
    details: dict = Field(default_factory=dict)


class CreateOrgRequest(BaseModel):
    name: str


class OrgResponse(BaseModel):
    id: str
    name: str
    owner_email: str
    members: list[str]
    sso_enabled: bool
    created_at: datetime


class AuditResponse(BaseModel):
    entries: list[AuditEntry]
    total: int


# --- Audit logging ---

def log_audit(
    user_email: str,
    action: str,
    resource_type: str,
    resource_id: str = "",
    org_id: str = "",
    details: dict | None = None,
) -> None:
    """Record an audit log entry."""
    _audit_log.append(AuditEntry(
        org_id=org_id,
        user_email=user_email,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details or {},
    ))


def _get_user(authorization: str):
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Invalid authorization header")
    token = authorization[7:]
    user = auth.get_user_from_token(token)
    if not user:
        raise HTTPException(401, "Invalid or expired token")
    return user


# --- Organization endpoints ---

@router.post("/orgs", response_model=OrgResponse)
async def create_org(req: CreateOrgRequest, authorization: str = Header(...)):
    user = _get_user(authorization)

    org = Organization(
        name=req.name,
        owner_email=user.email,
        members=[user.email],
    )
    _organizations[org.id] = org

    log_audit(user.email, "create", "organization", org.id, org.id)

    return OrgResponse(**org.model_dump(include={"id", "name", "owner_email", "members", "sso_enabled", "created_at"}))


@router.get("/orgs", response_model=list[OrgResponse])
async def list_orgs(authorization: str = Header(...)):
    user = _get_user(authorization)

    return [
        OrgResponse(**org.model_dump(include={"id", "name", "owner_email", "members", "sso_enabled", "created_at"}))
        for org in _organizations.values()
        if user.email in org.members
    ]


@router.get("/orgs/{org_id}", response_model=OrgResponse)
async def get_org(org_id: str, authorization: str = Header(...)):
    user = _get_user(authorization)

    org = _organizations.get(org_id)
    if not org:
        raise HTTPException(404, "Organization not found")
    if user.email not in org.members:
        raise HTTPException(403, "Not a member of this organization")

    return OrgResponse(**org.model_dump(include={"id", "name", "owner_email", "members", "sso_enabled", "created_at"}))


# --- SSO stubs ---

class SSOConfigRequest(BaseModel):
    provider: str  # "saml" or "oidc"
    entity_id: str = ""
    sso_url: str = ""
    certificate: str = ""
    client_id: str = ""
    client_secret: str = ""
    issuer: str = ""


@router.post("/orgs/{org_id}/sso")
async def configure_sso(org_id: str, req: SSOConfigRequest, authorization: str = Header(...)):
    user = _get_user(authorization)

    org = _organizations.get(org_id)
    if not org:
        raise HTTPException(404, "Organization not found")
    if user.email != org.owner_email:
        raise HTTPException(403, "Only the org owner can configure SSO")

    if req.provider not in ("saml", "oidc"):
        raise HTTPException(400, "Provider must be 'saml' or 'oidc'")

    org.sso_provider = req.provider
    org.sso_config = req.model_dump(exclude={"provider"})
    org.sso_enabled = True

    log_audit(user.email, "configure_sso", "organization", org_id, org_id, {"provider": req.provider})

    return {"status": "ok", "message": f"SSO configured with {req.provider}"}


@router.get("/orgs/{org_id}/sso")
async def get_sso_config(org_id: str, authorization: str = Header(...)):
    user = _get_user(authorization)

    org = _organizations.get(org_id)
    if not org:
        raise HTTPException(404, "Organization not found")
    if user.email != org.owner_email:
        raise HTTPException(403, "Only the org owner can view SSO config")

    return {
        "enabled": org.sso_enabled,
        "provider": org.sso_provider,
    }


# --- Audit log endpoints ---

@router.get("/orgs/{org_id}/audit", response_model=AuditResponse)
async def get_audit_log(
    org_id: str,
    limit: int = 50,
    authorization: str = Header(...),
):
    user = _get_user(authorization)

    org = _organizations.get(org_id)
    if not org:
        raise HTTPException(404, "Organization not found")
    if user.email != org.owner_email:
        raise HTTPException(403, "Only the org owner can view audit logs")

    org_entries = [e for e in _audit_log if e.org_id == org_id]
    org_entries.sort(key=lambda e: e.timestamp, reverse=True)

    return AuditResponse(
        entries=org_entries[:limit],
        total=len(org_entries),
    )
