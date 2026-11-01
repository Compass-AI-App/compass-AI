# Maintained desktop dependencies

## Problem Framing
The desktop baseline used an unsupported Electron generation and older dependency resolutions. Desktop checks also needed to run every existing suite consistently under a supported build-time Node version.

## Approach
Update the pinned Electron runtime and packaging dependencies, refresh the public-registry lockfile, use Node 24 in CI and release jobs, and run all desktop suites through one command. Preserve the separate IPC and credential-migration scripts.

## Key Decisions
Current release verification superseded the prepared Electron pin with the latest stable patch. Keep the audit threshold explicit and retain the moderate packaging-toolchain findings rather than applying the suggested incompatible builder downgrade.

## Outcome
A public-registry install, all desktop tests, typechecks and build passed, and the downloaded ARM64 Electron binary ran at the expected version. Audits report no production-dependency advisories and no high or critical findings overall; fifteen moderate packaging-toolchain findings remain. Installed-app and platform acceptance are still required.
