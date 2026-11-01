# Resumable native workspace maintenance

## Problem Framing
Desktop users need an explicit way to remove managed workspace data while preserving original sources and separate recovery copies. An interrupted deletion must remain visible and resumable instead of allowing saved-data access to continue silently.

## Approach
Run the fixed managed-data deletion procedure through a native maintenance worker after workspace approval and engine shutdown. Fence saved-data access while a deletion marker remains, preserve registered source boundaries, and retain recovery paths after failures.

## Key Decisions
A disposable substitution probe exposed a path race in the earlier implementation. Anchor inventory, marker writes, config replacement and removal to verified directory descriptors, reject changed workspace identities and retain recovery markers when an operation is interrupted.

## Outcome
Offline engine and desktop checks passed, including directory-substitution, interrupted-deletion and source-protection regressions. The same substitution probe now refuses the operation while preserving both fixture datasets; owner-data operations and a rebuilt signed candidate remain unverified.
