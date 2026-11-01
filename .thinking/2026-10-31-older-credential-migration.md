# Older credential migration

## Problem Framing
Older browser and native credential stores can retain copies after users connect or sign out through the current AI vault. Migration and cleanup must preserve recoverable credentials when validation, storage or removal fails.

## Approach
Validate an older key with the selected provider, verify its source is unchanged, save it through the current protected vault, then remove the older copy. Expose only migration status over the new IPC methods and retire generic credential read/write handlers.

## Key Decisions
Serialize key saves with sign-out, avoid duplicate connections on migration retry and remove matching older copies before completing local sign-out. Keep unrelated credentials and settings intact; require separate confirmation to clear the entire older credential store.

## Outcome
Desktop tests, typechecks and build passed, including failed validation, locked-storage policy, changed-source checks, failed writes, cleanup retries and duplicate-copy sign-out. Verification used fictional credentials and mocked encryption/provider responses; live OS protection and real account acceptance remain unverified.
