# Spec

The optional `policy.selection` contains one path and exact content digest. Its
source is a compact JSON `steer-gate-policy-selection/v1` document containing the
organization, repository, branch and complete selected `configuration.gates`.
The manifest excludes its own selection reference to avoid a hash cycle. Every
nested signer, trust/proof reference, policy, reviewer/runner/history/ancestry and
evidence selection must match the parsed startup configuration, including array order.
No manifest-supplied configuration is executed or adopted as a fallback.

Reject path collisions with configured source roles and excessive configuration size
before I/O. Read at the exact requested current head, check tenant/path/revision,
SHA-256 and native Git blob hash, canonical JSON and the complete configuration.
Bound the manifest to 512 KiB and count it toward the existing aggregate budget.
Reuse the collector's single-flight, 15-second deadline, monotonic time, observer
identity/expiry checks and draining shutdown. Recheck observer/head before following
the evidence chain; retain the existing final checks. No newer revision fallback.

Expose only immutable selection-source fingerprints and normalized configuration
digest through the held assessment; do not expose the manifest's contents there.
Absent selection remains explicitly null for legacy configuration. A present but
invalid source fails the assessment. No selection, review-provenance, current-source,
gate or write authority requirement is cleared by a matching file. Trusted bootstrap
pin selection and actual governance approval remain external obligations.

Test actual native Git source/whole-selection binding and runtime propagation, hostile
scope/configuration/bytes/currentness, observer drift/expiry and pending shutdown.
No live manifest/configuration/grant, signed artifact or formal finding is changed.
