"""Authentication module — JWT-based auth with in-memory user store."""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from base64 import urlsafe_b64decode, urlsafe_b64encode

import httpx

from compass_cloud.models import User, Plan, PLAN_LIMITS

# In-memory store for development. Replace with Postgres for production.
_users: dict[str, User] = {}  # email -> User
_tokens: dict[str, str] = {}  # token -> email

# Secret for JWT signing. In production, use a proper secret from env.
JWT_SECRET = "compass-cloud-dev-secret-change-in-production"
JWT_EXPIRY_SECONDS = 86400 * 7  # 7 days


def _hash_password(password: str) -> str:
    """Hash a password with SHA-256. In production, use bcrypt."""
    return hashlib.sha256(password.encode()).hexdigest()


def _create_jwt(user_id: str, email: str) -> str:
    """Create a simple JWT token."""
    header = urlsafe_b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()).decode().rstrip("=")
    payload_data = {
        "sub": user_id,
        "email": email,
        "exp": int(time.time()) + JWT_EXPIRY_SECONDS,
    }
    payload = urlsafe_b64encode(json.dumps(payload_data).encode()).decode().rstrip("=")
    signature_input = f"{header}.{payload}"
    sig = hmac.new(JWT_SECRET.encode(), signature_input.encode(), hashlib.sha256).hexdigest()
    return f"{header}.{payload}.{sig}"


def _verify_jwt(token: str) -> dict | None:
    """Verify and decode a JWT token. Returns payload dict or None."""
    parts = token.split(".")
    if len(parts) != 3:
        return None

    header, payload, sig = parts
    signature_input = f"{header}.{payload}"
    expected_sig = hmac.new(JWT_SECRET.encode(), signature_input.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(sig, expected_sig):
        return None

    # Decode payload
    padding = 4 - len(payload) % 4
    payload_bytes = urlsafe_b64decode(payload + "=" * padding)
    payload_data = json.loads(payload_bytes)

    if payload_data.get("exp", 0) < time.time():
        return None

    return payload_data


def signup(email: str, password: str) -> tuple[User, str]:
    """Create a new user. Returns (user, token). Raises ValueError if email taken."""
    if email in _users:
        raise ValueError("Email already registered")

    user = User(
        email=email,
        password_hash=_hash_password(password),
    )
    _users[email] = user

    token = _create_jwt(user.id, email)
    _tokens[token] = email
    return user, token


def login(email: str, password: str) -> tuple[User, str]:
    """Authenticate a user. Returns (user, token). Raises ValueError on failure."""
    user = _users.get(email)
    if not user:
        raise ValueError("Invalid email or password")

    if user.password_hash != _hash_password(password):
        raise ValueError("Invalid email or password")

    token = _create_jwt(user.id, email)
    _tokens[token] = email
    return user, token


def get_user_from_token(token: str) -> User | None:
    """Get user from a JWT token. Returns None if invalid."""
    payload = _verify_jwt(token)
    if not payload:
        return None

    email = payload.get("email")
    if not email:
        return None

    return _users.get(email)


def get_user_by_email(email: str) -> User | None:
    """Get user by email."""
    return _users.get(email)


def check_token_limit(user: User) -> bool:
    """Check if user is within their plan's token limit."""
    limit = PLAN_LIMITS[user.plan]
    if limit == -1:
        return True  # unlimited
    return user.token_usage_month < limit


def record_usage(user: User, tokens: int) -> None:
    """Record token usage for a user."""
    user.token_usage_month += tokens


# ---- Social Auth ----

# Index: provider + provider_user_id -> email
_provider_index: dict[str, str] = {}  # "github:12345" -> email


async def _fetch_github_profile(access_token: str) -> dict:
    """Fetch GitHub user profile using an access token."""
    async with httpx.AsyncClient() as client:
        res = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
        )
        res.raise_for_status()
        data = res.json()
        email = data.get("email") or ""
        if not email:
            email_res = await client.get(
                "https://api.github.com/user/emails",
                headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
            )
            if email_res.status_code == 200:
                emails = email_res.json()
                primary = next((e for e in emails if e.get("primary")), None)
                email = (primary or emails[0])["email"] if emails else ""
        return {
            "id": str(data["id"]),
            "name": data.get("name") or data.get("login", ""),
            "email": email,
            "avatar_url": data.get("avatar_url", ""),
        }


async def _fetch_google_profile(access_token: str) -> dict:
    """Fetch Google user profile using an access token."""
    async with httpx.AsyncClient() as client:
        res = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        res.raise_for_status()
        data = res.json()
        return {
            "id": data.get("id", ""),
            "name": data.get("name", ""),
            "email": data.get("email", ""),
            "avatar_url": data.get("picture", ""),
        }


async def oauth_login(provider: str, access_token: str) -> tuple[User, str]:
    """Authenticate via social provider. Creates account if new. Returns (user, jwt)."""
    if provider == "github":
        profile = await _fetch_github_profile(access_token)
    elif provider == "google":
        profile = await _fetch_google_profile(access_token)
    else:
        raise ValueError(f"Unsupported OAuth provider: {provider}")

    if not profile.get("email"):
        raise ValueError(f"Could not retrieve email from {provider}")

    provider_key = f"{provider}:{profile['id']}"
    email = profile["email"]

    # Check if we already have this provider user
    existing_email = _provider_index.get(provider_key)
    if existing_email and existing_email in _users:
        user = _users[existing_email]
        # Update profile fields
        user.name = profile.get("name", user.name)
        user.avatar_url = profile.get("avatar_url", user.avatar_url)
        token = _create_jwt(user.id, user.email)
        _tokens[token] = user.email
        return user, token

    # Check if email already registered (link account)
    if email in _users:
        user = _users[email]
        user.auth_provider = provider
        user.provider_user_id = profile["id"]
        user.name = profile.get("name", user.name)
        user.avatar_url = profile.get("avatar_url", user.avatar_url)
        _provider_index[provider_key] = email
        token = _create_jwt(user.id, email)
        _tokens[token] = email
        return user, token

    # Create new user
    user = User(
        email=email,
        auth_provider=provider,
        provider_user_id=profile["id"],
        name=profile.get("name", ""),
        avatar_url=profile.get("avatar_url", ""),
    )
    _users[email] = user
    _provider_index[provider_key] = email
    token = _create_jwt(user.id, email)
    _tokens[token] = email
    return user, token
