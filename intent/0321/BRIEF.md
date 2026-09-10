# 0321 — Exact caller identity in shared source review

Remove duplicate invocation of the same caller at a shared source-review boundary.
The final save-review and preview/confirmation path currently wraps the same
callback separately for parent and child, then checks both around the same IO.
Preserve exact guarded callback identity inside the constructed private session,
so the source owner can check it once per boundary. Keep independent callbacks,
fresh checks around every read, full final validation and actual drain intact.

Base: `9346b93e451616cb8a5c9b1017f57503f2e4d902`. Partial C22 only; no model
spending, runtime GitHub save, activation, deployment or signature. Fixed progress
remains 68% (17/25) until a complete acceptance checkpoint passes.
