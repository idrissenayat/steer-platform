# Specification

- S1: Add the strict human-only `intent.scope.history` query with a distinct
  historical output kind, exact review reference and no-store delivery.
- S2: Read immutable scope operation metadata under current historical authority,
  limited runtime role and RLS without dispatch, reservation, checkpoint or renewal.
- S3: Recover exact encrypted request/response evidence under present records,
  retained-source, profile, lifecycle and historical-key checks. Verify pinned SDK
  encoding/usage and durable succeeded digests; strip checkpoint capability.
- S4: Combine only verified succeeded batches against their original full source
  plan; preserve incomplete/unresolved states. Recheck originals and batch snapshot.
- S5: Add explicit history inspection to the actual editor. Label historical versus
  current revisions and expiry, show original source references/citations, preserve
  human edits, and never pass history to the current-assessment callback.
- S6: Clear denied/stale/hidden/expired view content; prevent late response revival.
  Preserve metadata-only same-origin transport, bounded requests, no implicit retry,
  no browser persistence and keyboard focus.
- S7: Keep default runtime bindings inactive and current-only reads/admission intact.
  Test source fidelity, owner/permission loss, expiry, uncertainty and no side effects.
