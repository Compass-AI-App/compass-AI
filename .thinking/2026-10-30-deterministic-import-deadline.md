# Deterministic import deadline regression

## Problem Framing
A deadline regression depended on the worker being scheduled within a short real-time timeout. Continuous integration could expire that deadline before the reader started, failing the setup assertion rather than testing a late result.

## Approach
Advance a clock scoped to the import module only after the reader signals it has started. Keep polling and synchronization on real time so the test still fails within a bounded interval.

## Key Decisions
Preserve the production timeout implementation and the assertions that a late reader cannot replace previously accepted evidence. Keep the correction separate from the workspace maintenance feature.

## Outcome
The focused regression passed ten independent runs, and the offline engine suite passed. This verifies deterministic deadline behavior under controlled conditions; it does not establish live provider output quality.
