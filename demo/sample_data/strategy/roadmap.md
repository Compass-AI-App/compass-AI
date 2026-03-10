# SyncFlow Roadmap — 2026

## Q1 (Current — ends March 31)
- [x] Slack integration v2
- [x] Jira bi-directional sync
- [ ] **WebSocket sync engine rewrite** — migrate from polling to event-driven (started: no, blocked on architect hire)
- [ ] SOC2 audit completion (in progress, auditor engaged)
- [ ] SSO integration — Okta, Azure AD (not started, dependent on SOC2)
- [ ] Connection pool scaling (not started)

## Q2
- [ ] Developer API beta (3 design partners waiting)
- [ ] GitHub integration
- [ ] Batch export for enterprise compliance
- [ ] Custom field mapping UI

## Q3
- [ ] API GA launch
- [ ] Salesforce integration
- [ ] Sync conflict resolution UI
- [ ] Mobile notifications

## Q4
- [ ] Marketplace for community connectors
- [ ] AI-powered mapping suggestions
- [ ] Multi-workspace sync

## Technical Debt (Acknowledged, Not Prioritized)
- Migrate to async processing pipeline (on roadmap since Q3 2025, not started)
- Improve error handling and retry logic (reduced retries in Nov 2025 due to cascade issue)
- Database query optimization for large accounts
- Connection pool sizing (currently fixed at 50, need dynamic scaling)
- Monitoring upgrade (currently logging to stdout only)
