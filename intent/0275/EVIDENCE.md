# Development evidence — 2026-09-09

Base: `842c28a031adf046071b0c78dccf09861ebe5b19` (0274).

## Implementation and current verification

The existing joined authenticated case now passes its actual confirmed reference
and human-corrected documents into a [worker-owned integration helper](../../apps/worker/test/authenticated-candidate-save.integration.ts).
The real factory constructs start/status/exact-read services; only synthetic
authority, scheduler and native-provider ports are supplied. Those save policies
remain closed throughout generation and confirmation. No injected `createApi`
principal, fixed HTTP output or substituted journey service is used.

The `--journey-runtime` selection passes all three joined checks plus idempotent
migration verification, preserving the prior generation/confirmation assertions.
It is not the full SQL suite. The continuation verifies:

- Start-policy denial returns 503 without a step, scheduler call, native mutation,
  extra original or reservation. The save policy is distinct from confirmation.
- The actual authenticated start service recovers a lost scheduler acknowledgement
  as the same fixed workflow: one scheduler start, no save claim before execution.
- One single-attempt activity produces one native Git commit, then reports an
  uncertain result after a lost provider acknowledgement. History contains only
  references, not documents, credentials or manifest/authority payloads. Replay
  does not resend.
- After reconstructing the actual identity/factory, HTTP status verifies the exact
  provider receipt without changing the dispatch marker. Separate reconciliation
  records completion; repeated start cannot create a second workflow or commit.
- A later synthetic root edit does not redirect exact reopen. All three documents,
  the human Brief correction and manifest bytes match the confirmed older commit.
  Read-policy denial returns 503 without private text; current Git tool-grant
  revocation returns 403.
- Encrypted original rows remain identical, with two operations, one original and
  six total synthetic model calls/reservations. All four managed API runtimes,
  their SQL pools and owned worker/harness resources close. The runner removes only
  its disposable PostgreSQL container/tmpfs and native Git fixture data.

API/worker typechecks pass. The initial helper location under API tests correctly
failed Temporal dependency resolution; it was moved to the worker's test ownership
instead of adding worker dependencies to the API package. No production package
manifest or dependency boundary changed.

Final broad regression: **1,341 tests pass**, zero failed/cancelled/skipped,
138,444 ms, concurrency four. Prototype and all eight package typechecks pass
(six unchanged package checks use local Turbo cache); the optimized Next build
passes. Protected Architecture/Exam/accepted-retention hashes, the 95-artifact kit,
read-only workflow scope audit, 206 local links across six changed/new documents
and diff whitespace checks pass. User-owned `docs/REAL-USER-ROADMAP.md` and `outputs/`
remain untouched and excluded. No passing browser or live-provider performance
result is claimed.

## Boundaries

Direct recorded SDK scope/drafting workers remain unchanged; only the save uses
the fixed Temporal activity. This joins already implemented components, not a new
live deployment or signed-in browser demonstration. No publication records action,
clock adoption, D1 adoption, paid model call, real GitHub runtime write/grant,
signature, release or deletion is authorized. The 47–50-second confirmation and
high native-request volume from 0274 remain unresolved performance work.
This joined save covers `new-distinct`; other dispositions retain their existing
preview coverage, not complete authenticated save acceptance. Current adopted
authority bindings and owned scope/drafting worker scheduling also remain open.
