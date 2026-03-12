"""Team workspaces — shared workspace metadata with privacy-preserving evidence.

Evidence stays local to each user's machine. Only workspace metadata
(name, description, connected source types, member list) is shared
through the cloud API.
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from compass_cloud import auth

router = APIRouter(prefix="/teams", tags=["teams"])

# In-memory store
_workspaces: dict[str, "TeamWorkspace"] = {}  # workspace_id -> TeamWorkspace


class MemberAccess(BaseModel):
    email: str
    role: str = "read"  # "read" or "write"


class TeamWorkspace(BaseModel):
    id: str = Field(default_factory=lambda: __import__("uuid").uuid4().hex[:12])
    name: str
    description: str = ""
    owner_email: str
    members: list[str] = Field(default_factory=list)  # email list
    member_access: list[MemberAccess] = Field(default_factory=list)
    source_types: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)


class CreateWorkspaceRequest(BaseModel):
    name: str
    description: str = ""


class InviteRequest(BaseModel):
    email: str
    role: str = "read"  # "read" or "write"


class WorkspaceResponse(BaseModel):
    id: str
    name: str
    description: str
    owner_email: str
    members: list[str]
    member_access: list[MemberAccess] = Field(default_factory=list)
    source_types: list[str]
    created_at: datetime


def _get_user(authorization: str):
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Invalid authorization header")
    token = authorization[7:]
    user = auth.get_user_from_token(token)
    if not user:
        raise HTTPException(401, "Invalid or expired token")
    return user


@router.post("/workspaces", response_model=WorkspaceResponse)
async def create_workspace(req: CreateWorkspaceRequest, authorization: str = Header(...)):
    user = _get_user(authorization)

    ws = TeamWorkspace(
        name=req.name,
        description=req.description,
        owner_email=user.email,
        members=[user.email],
    )
    _workspaces[ws.id] = ws

    return WorkspaceResponse(**ws.model_dump())


@router.get("/workspaces", response_model=list[WorkspaceResponse])
async def list_workspaces(authorization: str = Header(...)):
    user = _get_user(authorization)

    user_workspaces = [
        WorkspaceResponse(**ws.model_dump())
        for ws in _workspaces.values()
        if user.email in ws.members
    ]
    return user_workspaces


@router.get("/workspaces/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(workspace_id: str, authorization: str = Header(...)):
    user = _get_user(authorization)

    ws = _workspaces.get(workspace_id)
    if not ws:
        raise HTTPException(404, "Workspace not found")
    if user.email not in ws.members:
        raise HTTPException(403, "Not a member of this workspace")

    return WorkspaceResponse(**ws.model_dump())


@router.post("/workspaces/{workspace_id}/invite")
async def invite_member(workspace_id: str, req: InviteRequest, authorization: str = Header(...)):
    user = _get_user(authorization)

    ws = _workspaces.get(workspace_id)
    if not ws:
        raise HTTPException(404, "Workspace not found")
    if user.email != ws.owner_email:
        raise HTTPException(403, "Only the workspace owner can invite members")
    if req.email in ws.members:
        raise HTTPException(400, "User is already a member")

    ws.members.append(req.email)
    ws.member_access.append(MemberAccess(email=req.email, role=req.role))
    return {"status": "ok", "message": f"Invited {req.email} with {req.role} access"}


@router.delete("/workspaces/{workspace_id}/members/{email}")
async def remove_member(workspace_id: str, email: str, authorization: str = Header(...)):
    user = _get_user(authorization)

    ws = _workspaces.get(workspace_id)
    if not ws:
        raise HTTPException(404, "Workspace not found")
    if user.email != ws.owner_email:
        raise HTTPException(403, "Only the workspace owner can remove members")
    if email == ws.owner_email:
        raise HTTPException(400, "Cannot remove the workspace owner")
    if email not in ws.members:
        raise HTTPException(404, "User is not a member")

    ws.members.remove(email)
    return {"status": "ok", "message": f"Removed {email}"}
