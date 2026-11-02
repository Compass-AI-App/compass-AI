# Runtime build host selection

## Problem Framing
Both native packaging jobs failed before runtime assembly because the workflow requested an exact host Python patch unavailable from the setup action. The bundled runtime archive and the interpreter used to assemble it are separate dependencies.

## Approach
Select an available Python patch within the build host's existing minor series in both CI and release workflows. Keep the bundled interpreter version, archive checksum, dependency lock and packaging checks unchanged.

## Outcome
Both workflow files parse, and the official host-version manifest lists native builds for both target architectures. The original four app and engine checks passed while both packaging jobs failed at setup; corrected remote packaging remains unverified until the revised commit is approved and pushed.
