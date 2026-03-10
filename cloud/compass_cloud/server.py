"""Compass Cloud API server."""

from __future__ import annotations

from fastapi import FastAPI, Header, HTTPException
from compass_cloud.models import (
    AuthRequest,
    AuthResponse,
    UserResponse,
    PLAN_LIMITS,
)
from compass_cloud import auth
from compass_cloud.proxy import router as proxy_router
from compass_cloud.billing import router as billing_router
from compass_cloud.teams import router as teams_router
from compass_cloud.enterprise import router as enterprise_router

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
