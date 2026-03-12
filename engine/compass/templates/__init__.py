"""Project templates for Compass workspaces.

Each template pre-configures recommended sources, default chat mode,
example questions, and a starter compass.yaml for a specific product type.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class ProjectTemplate:
    """A project template definition."""
    id: str
    name: str
    description: str
    icon: str  # Lucide icon name
    recommended_sources: list[str]
    default_chat_mode: str
    example_questions: list[str]
    starter_config: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "icon": self.icon,
            "recommended_sources": self.recommended_sources,
            "default_chat_mode": self.default_chat_mode,
            "example_questions": self.example_questions,
        }


TEMPLATES: dict[str, ProjectTemplate] = {
    "b2b_saas": ProjectTemplate(
        id="b2b_saas",
        name="B2B SaaS",
        description="Enterprise software with recurring revenue model",
        icon="Building2",
        recommended_sources=["code", "docs", "jira", "slack", "analytics"],
        default_chat_mode="product-strategy",
        example_questions=[
            "What are the top customer pain points based on support tickets and interviews?",
            "Where do our product docs contradict what the code actually does?",
            "What features are customers requesting that we haven't prioritized?",
            "How does our current roadmap align with customer feedback?",
        ],
        starter_config={
            "sources": [
                {"type": "code", "name": "Code", "path": None},
                {"type": "docs", "name": "Product Docs", "path": None},
                {"type": "jira", "name": "Jira Issues", "path": None},
            ],
        },
    ),
    "consumer_app": ProjectTemplate(
        id="consumer_app",
        name="Consumer App",
        description="Mobile or web app targeting individual users",
        icon="Smartphone",
        recommended_sources=["code", "analytics", "interviews", "support"],
        default_chat_mode="product-strategy",
        example_questions=[
            "What user segments show the highest engagement but lowest retention?",
            "Which features do users complain about most in reviews and support tickets?",
            "What opportunities exist based on user interview themes?",
            "Where does our analytics data contradict our product assumptions?",
        ],
        starter_config={
            "sources": [
                {"type": "code", "name": "Code", "path": None},
                {"type": "analytics", "name": "Usage Analytics", "path": None},
                {"type": "interviews", "name": "User Research", "path": None},
            ],
        },
    ),
    "platform_api": ProjectTemplate(
        id="platform_api",
        name="Platform / API",
        description="Developer platform, API, or infrastructure product",
        icon="Boxes",
        recommended_sources=["code", "docs", "github", "slack"],
        default_chat_mode="technical",
        example_questions=[
            "What API endpoints have the most breaking changes in recent commits?",
            "Where do our API docs not match the actual implementation?",
            "What are developers asking about most in Slack?",
            "What integration patterns are most common based on code analysis?",
        ],
        starter_config={
            "sources": [
                {"type": "code", "name": "Code", "path": None},
                {"type": "docs", "name": "API Docs", "path": None},
            ],
        },
    ),
    "marketplace": ProjectTemplate(
        id="marketplace",
        name="Marketplace",
        description="Two-sided marketplace connecting buyers and sellers",
        icon="Store",
        recommended_sources=["analytics", "support", "interviews", "docs"],
        default_chat_mode="product-strategy",
        example_questions=[
            "What's the supply vs demand imbalance based on marketplace data?",
            "Which seller/buyer pain points are most frequent in support tickets?",
            "What pricing or commission changes would improve marketplace health?",
            "How do our marketplace metrics compare to the goals in our strategy docs?",
        ],
        starter_config={
            "sources": [
                {"type": "analytics", "name": "Marketplace Metrics", "path": None},
                {"type": "support", "name": "Customer Support", "path": None},
                {"type": "interviews", "name": "User Research", "path": None},
            ],
        },
    ),
    "internal_tool": ProjectTemplate(
        id="internal_tool",
        name="Internal Tool",
        description="Internal productivity or operations tool",
        icon="Wrench",
        recommended_sources=["code", "docs", "slack", "interviews"],
        default_chat_mode="product-strategy",
        example_questions=[
            "What are the most common complaints from internal users?",
            "Which workflows take the most time based on user feedback?",
            "What automations would have the highest impact on productivity?",
            "Where do internal docs describe processes that differ from actual usage?",
        ],
        starter_config={
            "sources": [
                {"type": "code", "name": "Code", "path": None},
                {"type": "docs", "name": "Internal Docs", "path": None},
                {"type": "slack", "name": "Team Slack", "path": None},
            ],
        },
    ),
}


def get_template(template_id: str) -> ProjectTemplate | None:
    """Get a template by ID."""
    return TEMPLATES.get(template_id)


def list_templates() -> list[dict]:
    """List all available templates."""
    return [t.to_dict() for t in TEMPLATES.values()]
