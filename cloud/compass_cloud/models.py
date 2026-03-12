"""Data models for Compass Cloud."""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class Plan(str, Enum):
    FREE = "free"
    PRO = "pro"
    MAX = "max"


PLAN_LIMITS = {
    Plan.FREE: 50_000,
    Plan.PRO: 500_000,
    Plan.MAX: -1,  # unlimited
}

PLAN_PRICES = {
    Plan.FREE: 0,
    Plan.PRO: 29,
    Plan.MAX: 79,
}


class User(BaseModel):
    id: str = Field(default_factory=lambda: __import__("uuid").uuid4().hex[:12])
    email: str
    password_hash: str = ""
    plan: Plan = Plan.FREE
    stripe_customer_id: str = ""
    created_at: datetime = Field(default_factory=datetime.now)
    token_usage_month: int = 0
    token_usage_reset: datetime = Field(default_factory=datetime.now)
    # Social auth fields
    auth_provider: str = ""  # "github", "google", or "" for email/password
    provider_user_id: str = ""
    name: str = ""
    avatar_url: str = ""


class TokenUsage(BaseModel):
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0


class AuthRequest(BaseModel):
    email: str
    password: str


class OAuthRequest(BaseModel):
    """Request for social auth — exchange provider token for Cloud token."""
    provider: str  # "github" or "google"
    access_token: str


class AuthResponse(BaseModel):
    token: str
    user_id: str
    email: str
    plan: Plan


class UserResponse(BaseModel):
    id: str
    email: str
    plan: Plan
    created_at: datetime
    token_usage_month: int
    token_limit: int
