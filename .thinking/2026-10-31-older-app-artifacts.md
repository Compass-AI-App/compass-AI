# Older app artifact preservation

## Problem Framing
Older presentations, prototypes, pinned charts, conversations and feedback lack reliable workspace ownership. Removing one workspace cannot safely determine which of those app-profile records belong to it.

## Approach
Provide an app-profile-wide inventory, private text export and separately confirmed clearing action. Preserve exact stored strings, including malformed records, without executing artifact content or reading credential entries.

## Key Decisions
Use a fixed legacy-key allowlist, snapshot comparison and serialized dialogs to prevent changed records from being cleared or exported under stale approval. Report interrupted clearing and preserve unrelated settings.

## Outcome
Desktop checks, typechecks and build passed, including cancellation, malformed-content export, snapshot changes, rollback and dialog serialization. Verification used disposable storage fixtures; no owner artifacts were exported or cleared.
