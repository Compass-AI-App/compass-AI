"""LLM Proxy — authenticated, metered access to Claude through Compass Cloud.

Proxies LLM calls through Compass's own Anthropic key so users don't need BYOK.
Tracks per-user token usage and enforces plan limits.
"""

from __future__ import annotations

import os

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from compass_cloud import auth
from compass_cloud.models import PLAN_LIMITS

router = APIRouter(prefix="/proxy", tags=["proxy"])


class CompletionRequest(BaseModel):
    prompt: str
    system: str = ""
    model: str = "claude-sonnet-4-20250514"
    max_tokens: int = 4096


class CompletionResponse(BaseModel):
    content: str
    input_tokens: int
    output_tokens: int
    model: str


class UsageResponse(BaseModel):
    plan: str
    token_usage_month: int
    token_limit: int
    remaining: int


def _get_user(authorization: str):
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Invalid authorization header")
    token = authorization[7:]
    user = auth.get_user_from_token(token)
    if not user:
        raise HTTPException(401, "Invalid or expired token")
    return user


@router.post("/complete", response_model=CompletionResponse)
async def complete(req: CompletionRequest, authorization: str = Header(...)):
    user = _get_user(authorization)

    # Check plan limits
    if not auth.check_token_limit(user):
        limit = PLAN_LIMITS[user.plan]
        raise HTTPException(
            429,
            f"Monthly token limit reached ({limit:,} tokens on {user.plan.value} plan). "
            "Upgrade your plan for more tokens.",
        )

    # Get Compass's own API key
    api_key = os.environ.get("COMPASS_ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(503, "LLM proxy not configured. Contact support.")

    try:
        import anthropic

        client = anthropic.Anthropic(api_key=api_key)

        messages = [{"role": "user", "content": req.prompt}]
        kwargs = {
            "model": req.model,
            "max_tokens": req.max_tokens,
            "messages": messages,
        }
        if req.system:
            kwargs["system"] = req.system

        response = client.messages.create(**kwargs)

        content = ""
        for block in response.content:
            if hasattr(block, "text"):
                content += block.text

        input_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens
        total = input_tokens + output_tokens

        # Record usage
        auth.record_usage(user, total)

        return CompletionResponse(
            content=content,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            model=req.model,
        )
    except ImportError:
        raise HTTPException(503, "Anthropic SDK not installed on server")
    except Exception as e:
        raise HTTPException(502, f"LLM call failed: {str(e)}")


@router.get("/usage", response_model=UsageResponse)
async def usage(authorization: str = Header(...)):
    user = _get_user(authorization)
    limit = PLAN_LIMITS[user.plan]
    remaining = max(0, limit - user.token_usage_month) if limit > 0 else -1

    return UsageResponse(
        plan=user.plan.value,
        token_usage_month=user.token_usage_month,
        token_limit=limit,
        remaining=remaining,
    )
