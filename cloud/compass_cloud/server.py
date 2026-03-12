"""Compass Cloud API server."""

from __future__ import annotations

from fastapi import FastAPI, Header, HTTPException
from compass_cloud.models import (
    AuthRequest,
    AuthResponse,
    OAuthRequest,
    UserResponse,
    PLAN_LIMITS,
)
from compass_cloud import auth
from compass_cloud.proxy import router as proxy_router
from compass_cloud.billing import router as billing_router
from compass_cloud.teams import router as teams_router
from compass_cloud.enterprise import router as enterprise_router
from compass_cloud.documents import (
    ShareDocumentRequest,
    ShareDocumentResponse,
    SharedDocumentView,
    share_document,
    get_shared_document,
    delete_shared_document,
    list_shared_documents,
)

app = FastAPI(
    title="Compass Cloud",
    version="0.1.0",
    description="Hosted Compass API with auth, LLM proxy, and billing.",
)

app.include_router(proxy_router)
app.include_router(billing_router)
app.include_router(teams_router)
app.include_router(enterprise_router)


def _get_current_user(authorization: str = Header(...)):
    """Extract and validate user from Authorization header."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Invalid authorization header")
    token = authorization[7:]
    user = auth.get_user_from_token(token)
    if not user:
        raise HTTPException(401, "Invalid or expired token")
    return user


@app.get("/health")
def health():
    return {"status": "ready", "service": "compass-cloud"}


@app.post("/auth/signup", response_model=AuthResponse)
def signup(req: AuthRequest):
    try:
        user, token = auth.signup(req.email, req.password)
    except ValueError as e:
        raise HTTPException(400, str(e))

    return AuthResponse(
        token=token,
        user_id=user.id,
        email=user.email,
        plan=user.plan,
    )


@app.post("/auth/oauth", response_model=AuthResponse)
async def oauth_login(req: OAuthRequest):
    """Exchange a provider OAuth token for a Compass Cloud token."""
    try:
        user, token = await auth.oauth_login(req.provider, req.access_token)
    except ValueError as e:
        raise HTTPException(400, str(e))

    return AuthResponse(
        token=token,
        user_id=user.id,
        email=user.email,
        plan=user.plan,
    )


@app.post("/auth/login", response_model=AuthResponse)
def login(req: AuthRequest):
    try:
        user, token = auth.login(req.email, req.password)
    except ValueError as e:
        raise HTTPException(401, str(e))

    return AuthResponse(
        token=token,
        user_id=user.id,
        email=user.email,
        plan=user.plan,
    )


@app.get("/auth/me", response_model=UserResponse)
def me(authorization: str = Header(...)):
    user = _get_current_user(authorization)
    return UserResponse(
        id=user.id,
        email=user.email,
        plan=user.plan,
        created_at=user.created_at,
        token_usage_month=user.token_usage_month,
        token_limit=PLAN_LIMITS[user.plan],
    )


# ---------- Document Sharing ----------


@app.post("/documents/share", response_model=ShareDocumentResponse)
def share_doc(req: ShareDocumentRequest, authorization: str = Header(...)):
    """Upload a document for sharing via link."""
    user = _get_current_user(authorization)
    doc = share_document(user.id, req)
    return ShareDocumentResponse(
        id=doc.id,
        url=f"/d/{doc.id}",
    )


@app.get("/d/{doc_id}", response_model=SharedDocumentView)
def view_shared_doc(doc_id: str, password: str | None = None):
    """View a shared document (public endpoint)."""
    doc = get_shared_document(doc_id, password)
    if not doc:
        raise HTTPException(404, "Document not found or password required")
    return SharedDocumentView(
        title=doc.title,
        doc_type=doc.doc_type,
        content_markdown=doc.content_markdown,
        content_html=doc.content_html,
        created_at=doc.created_at,
    )


@app.delete("/documents/shared/{doc_id}")
def delete_shared_doc(doc_id: str, authorization: str = Header(...)):
    """Delete a shared document (owner only)."""
    user = _get_current_user(authorization)
    if not delete_shared_document(doc_id, user.id):
        raise HTTPException(404, "Document not found or not owned by you")
    return {"status": "ok"}


@app.get("/documents/shared")
def list_shared_docs(authorization: str = Header(...)):
    """List shared documents for the current user."""
    user = _get_current_user(authorization)
    docs = list_shared_documents(user.id)
    return {"status": "ok", "documents": [d.model_dump() for d in docs]}
