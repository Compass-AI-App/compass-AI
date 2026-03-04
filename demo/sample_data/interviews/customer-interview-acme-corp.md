# Customer Interview: Sarah Chen, VP Engineering — Acme Corp

**Date:** 2026-02-15
**Interviewer:** PM Team
**Account:** Acme Corp (Enterprise, $45k ARR)
**Context:** Quarterly check-in, usage review

## Key Quotes

> "The sync is great when it works. But we've had three incidents this quarter where syncs just stopped for hours and we didn't know until someone noticed stale data in Jira."

> "We need better visibility into what's happening. Right now it's a black box. If I could see a dashboard showing sync health, that would be huge."

> "The batch export thing is something my team has been asking about for months. We have compliance requirements to export all synced data quarterly. Right now we're screen-scraping. It's embarrassing."

> "SSO is a dealbreaker for our security team. We renewed this quarter, but I had to personally vouch for SyncFlow. If SSO isn't done by next renewal, we're probably out."

## Feature Requests

1. **Sync health monitoring dashboard** — real-time visibility into sync status
2. **Batch export** — compliance-grade data export
3. **SSO (Okta)** — security requirement for renewal
4. **Webhook notifications** — alert when sync fails or stalls

## Usage Notes

- 150 active connections
- Primary integration: Jira ↔ Slack
- Also using: GitHub ↔ Jira
- Reported 3 sync failures in Q4
