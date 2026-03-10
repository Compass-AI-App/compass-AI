"""Stripe billing — subscription management and webhook handling.

In development mode (no STRIPE_SECRET_KEY), billing endpoints return mock
responses so the app works without Stripe credentials.
"""

from __future__ import annotations

import os

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel

from compass_cloud import auth
from compass_cloud.models import Plan, PLAN_PRICES

router = APIRouter(prefix="/billing", tags=["billing"])

STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

# Price IDs mapped in Stripe Dashboard
STRIPE_PRICE_IDS = {
    Plan.PRO: os.environ.get("STRIPE_PRO_PRICE_ID", "price_pro_placeholder"),
    Plan.MAX: os.environ.get("STRIPE_MAX_PRICE_ID", "price_max_placeholder"),
}


class PlanInfo(BaseModel):
    name: str
    price_monthly: int
    token_limit: int
    features: list[str]


class PlansResponse(BaseModel):
    plans: list[PlanInfo]


class UpgradeRequest(BaseModel):
    plan: str  # "pro" or "max"


class UpgradeResponse(BaseModel):
    checkout_url: str


def _get_user(authorization: str):
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Invalid authorization header")
    token = authorization[7:]
    user = auth.get_user_from_token(token)
    if not user:
        raise HTTPException(401, "Invalid or expired token")
    return user


@router.get("/plans", response_model=PlansResponse)
async def get_plans():
    return PlansResponse(plans=[
        PlanInfo(
            name="Free",
            price_monthly=0,
            token_limit=50_000,
            features=[
                "50k tokens/month",
                "All connectors",
                "CLI + MCP access",
            ],
        ),
        PlanInfo(
            name="Pro",
            price_monthly=29,
            token_limit=500_000,
            features=[
                "500k tokens/month",
                "All connectors",
                "CLI + MCP + App",
                "Priority support",
            ],
        ),
        PlanInfo(
            name="Max",
            price_monthly=79,
            token_limit=-1,
            features=[
                "Unlimited tokens",
                "All connectors",
                "CLI + MCP + App",
                "Priority support",
                "Early access features",
            ],
        ),
    ])


@router.post("/upgrade", response_model=UpgradeResponse)
async def upgrade(req: UpgradeRequest, authorization: str = Header(...)):
    user = _get_user(authorization)

    try:
        target_plan = Plan(req.plan.lower())
    except ValueError:
        raise HTTPException(400, f"Invalid plan: {req.plan}. Choose 'pro' or 'max'.")

    if target_plan == Plan.FREE:
        raise HTTPException(400, "Cannot upgrade to free plan. Use /billing/cancel instead.")

    if not STRIPE_SECRET_KEY:
        # Dev mode: directly upgrade without Stripe
        user.plan = target_plan
        return UpgradeResponse(checkout_url="dev://plan-upgraded")

    try:
        import stripe
        stripe.api_key = STRIPE_SECRET_KEY

        # Create or get Stripe customer
        if not user.stripe_customer_id:
            customer = stripe.Customer.create(email=user.email)
            user.stripe_customer_id = customer.id

        # Create checkout session
        session = stripe.checkout.Session.create(
            customer=user.stripe_customer_id,
            payment_method_types=["card"],
            line_items=[{
                "price": STRIPE_PRICE_IDS[target_plan],
                "quantity": 1,
            }],
            mode="subscription",
            success_url=os.environ.get("STRIPE_SUCCESS_URL", "https://compass.dev/billing/success"),
            cancel_url=os.environ.get("STRIPE_CANCEL_URL", "https://compass.dev/billing/cancel"),
            metadata={"user_email": user.email, "plan": target_plan.value},
        )

        return UpgradeResponse(checkout_url=session.url)

    except ImportError:
        raise HTTPException(503, "Stripe SDK not installed")
    except Exception as e:
        raise HTTPException(502, f"Stripe error: {str(e)}")


@router.post("/webhook")
async def webhook(request: Request):
    """Handle Stripe webhook events for subscription changes."""
    if not STRIPE_SECRET_KEY:
        return {"status": "dev_mode"}

    payload = await request.body()

    try:
        import stripe
        stripe.api_key = STRIPE_SECRET_KEY

        if STRIPE_WEBHOOK_SECRET:
            sig = request.headers.get("stripe-signature", "")
            event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
        else:
            import json
            event = json.loads(payload)

        event_type = event.get("type", "") if isinstance(event, dict) else event.type

        if event_type == "checkout.session.completed":
            session = event.get("data", {}).get("object", {}) if isinstance(event, dict) else event.data.object
            metadata = session.get("metadata", {}) if isinstance(session, dict) else session.metadata
            email = metadata.get("user_email", "")
            plan_str = metadata.get("plan", "")

            if email and plan_str:
                user = auth.get_user_by_email(email)
                if user:
                    user.plan = Plan(plan_str)

        elif event_type == "customer.subscription.deleted":
            session = event.get("data", {}).get("object", {}) if isinstance(event, dict) else event.data.object
            customer_id = session.get("customer", "") if isinstance(session, dict) else session.customer

            # Find user by stripe customer ID and downgrade to free
            for user in auth._users.values():
                if user.stripe_customer_id == customer_id:
                    user.plan = Plan.FREE
                    break

        return {"status": "ok"}

    except ImportError:
        raise HTTPException(503, "Stripe SDK not installed")
    except Exception as e:
        raise HTTPException(400, f"Webhook error: {str(e)}")
