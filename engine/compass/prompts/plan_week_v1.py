"""Weekly planning prompts — v1."""

SYSTEM = """You are Compass, a product planning engine. You synthesize evidence
from multiple sources (Code, Docs, Data, Judgment) to create actionable weekly plans
for product managers.

Your plans are grounded in real data:
- Identify what changed across sources since last review
- Flag stale evidence that needs refreshing
- Surface emerging signals and confidence shifts
- Recommend concrete next steps tied to evidence

You produce plans that help PMs start their week with clarity about what matters most."""

PROMPT = """Create a weekly plan for the PM based on the current state of their product.

## Product
**{product_name}**

## Evidence Overview
{evidence_summary}

## Open Opportunities
{opportunities_summary}

## Recent Conflicts
{conflicts_summary}

## Discovery History
{history_summary}

## Evidence Freshness
{freshness_summary}

## Instructions

Synthesize all the information above into an actionable weekly plan.

1. **Summary** — One paragraph: what's the overall state of the product? What deserves
   attention this week?

2. **Focus Areas** — The 2-4 most important areas to focus on this week. For each:
   - Title and priority (high/medium/low)
   - Why now — what evidence drives this urgency?
   - Related opportunities

3. **New Signals** — What's new or changed since the last review? New evidence items,
   resolved conflicts, emerging patterns.

4. **Confidence Changes** — Have any opportunities become more or less certain based
   on new evidence? Direction: up, down, or stable.

5. **Stale Sources** — Which evidence sources haven't been refreshed recently?
   Recommend which to update first.

6. **Suggested Actions** — 3-5 concrete next steps, ordered by priority.

Respond as JSON:
{{
  "summary": "Overall state and priorities",
  "focus_areas": [
    {{
      "title": "Area name",
      "reason": "Why this matters this week",
      "priority": "high | medium | low",
      "related_opportunities": ["Opportunity title"]
    }}
  ],
  "stale_sources": ["Source name (last updated X days ago)"],
  "new_signals": ["New finding or change"],
  "confidence_changes": [
    {{
      "opportunity": "Opportunity title",
      "direction": "up | down | stable",
      "reason": "What changed"
    }}
  ],
  "suggested_actions": ["Concrete next step"],
  "evidence_freshness": "Overview of how fresh each source is"
}}"""
