# Development evidence — 2026-09-08

Base: `ff600028b5112887bcf0522650172abda255d23b`.

## Implemented

The actual conversation/draft components now use reviewed metadata and recorded
prepare/start/read, expose progress and focused clarification, and preview both
role results before the human adopts Brief/Spec/Exam into the existing editors.
Preserve-and-review is one explicit action; missing coverage blocks generation.
Exact recovery requests, source-change invalidation and current-result checks
prevent duplicate starts and silent replacement of later human edits.

The new shared review query uses the existing encrypted draft service and mandatory
source-provenance authority. It is read-only and not installed in the real runtime.

## Verification

**205/205** disposable PostgreSQL integration checks pass on PostgreSQL 16.14.
New real HTTP-to-SQL review checks show exact evidence with no operations/originals/
reservations, denial for wrong/stale input, changed draft/head, provenance denial
and late identity revocation. Recorded SDK/Temporal fixtures now obtain source
metadata through the review API before prepare/start/result retrieval. Inventory,
provenance, model/budget authority and model responses remain synthetic.

Production-component testing covers preserved source, incomplete coverage, explicit
direction, one focused clarification, a lost second-run start, exact start recovery,
three candidate previews, explicit adoption, human Exam correction and refusal to
overwrite that correction with a subsequent result read. Inert Markdown, empty
browser storage and identity clearing are checked. No live-provider or human
acceptance claim is made.

**621/621** combined registry/data/agents/API/worker/web/domain, architecture-boundary
and real-migration-hold tests pass. Full prototype/eight-package typecheck, kit
validation (95 required artifacts), workflow token-scope audit and whitespace
checks pass. The architecture check explicitly permits only the four new portable
browser contracts and verifies their transitive closure excludes storage/provider/
dispatch code; it still rejects the server registry and provider imports.

The optimized Next.js production build also passes after the final UI changes.
Protected SHA-256 values remain unchanged:

- Architecture: `9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65`.
- Canonical Exam: `84ad1d4c14d6614fe4b53509104e379e9ad6dff0462c96109901eefb1e02fd7f`.
- Accepted records policy: `f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32`.

The combined preserve/review component test initially asserted before its
post-acknowledgement effect finished. It now waits boundedly for the actual review
result. Initial boundary checks also identified the missing explicit portable
export allowlist and its existing provider-free domain parser dependency; these
were corrected without allowing server/provider access. The full suite above was
rerun successfully after these changes.

## Limits

No actual workspace records/model/Git service was enabled. D1 remains unsigned and
inactive, the proposed $5 live-model test allowance remains unapproved, and live
GitHub saving/gates remain closed. Existing credentials were neither inspected,
created nor used; the API-key skill preserved the resolved credential choice.
No real migration, new key/grant, paid model call, runtime Git save, signed source,
deployment, release or deletion changed. Test cleanup removed only its own
disposable PostgreSQL container and synthetic tmpfs data.

Next: owned-draft/run discovery after refresh, real full-corpus/lifecycle authority,
semantic scope assessment, authorized runtime integration and the final live UI/save
acceptance journey. Component/database success does not complete I1–I6.
