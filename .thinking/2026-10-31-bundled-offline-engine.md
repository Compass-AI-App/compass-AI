# Bundled offline engine runtime

## Problem Framing
Packaged startup previously depended on a system Python installation and first-launch dependency setup. Missing dependencies, stalled health responses and concurrent restarts could leave startup unreliable.

## Approach
Assemble a relocatable CPython runtime from a checksum-pinned archive and hash-locked dependencies at build time. Require matching runtime receipts and engine bytes before packaging, isolate packaged Python from inherited environments and bound startup and cancellation.

## Key Decisions
Use native builds for each macOS architecture and reject unsupported or stale runtime packages. Keep optional vector dependencies off desktop startup and use SQLite retrieval without downloading an embedding model.

## Outcome
Offline engine and desktop tests, lint, typechecks, build and unsigned ARM64 packaging passed. A disposable packaged-runtime smoke exercised authenticated startup, evidence retrieval, backup/restore and deletion with restart without system Python or first-launch installation. Installed-app, signed-candidate, other-platform and real-account acceptance remain outstanding.
