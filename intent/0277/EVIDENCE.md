# Development evidence — 2026-09-09

Base: `d26cc3f2de775e4a46a29550a68737a3eca5243c` (0276).

## Verified implementation

The historical projection's internal scope port previously wrapped a private
window read in `checked`, and its source callback in `authority`. Both wrappers
called the same outer current-caller check already performed before and after
each callback by the private window. The port now retains guard/pending-operation
tracking and passes the original callback directly to that window. Its variable
starts unavailable, so the external reader cannot be used as an unwrapped fallback.

The window's implementation, first/final full scope reads, exact output comparison,
caller/source callback validation and closure are unchanged. All original/key/
records/lifecycle and independent role/predecessor verification remain in place.
This removes duplicate guards around an already guarded internal boundary, not
any distinct policy check or current Git-head resolution.

Twenty current/historical-window tests and data/API/worker typechecks pass. Three
new cases establish direct callback ordering, caller revocation within a callback
and missing-callback denial. A synthetic-only diagnostic now categorizes head,
commit/tree/blob, token and mutation counts without emitting any paths, identities
or provider data. Its unit check also passes; joined measurements remain pending.

The focused `--development-history` SQL selection passes all ten checks plus
idempotent migrations, including composed native corpus/SDK preview, confirmed
Temporal save/reopen, publication-record recovery under synthetic clock/authority,
late identity/records/key/source/result loss, incomplete or quarantined history,
expiry without renewal and predecessor verification after both SDK callbacks.
It is not the full SQL suite. Its runner closed its owned workers and removed only
its disposable native fixtures and PostgreSQL container/tmpfs data.

The authenticated `--journey-runtime` SQL/Temporal selection also passes all three
joined checks plus idempotent migrations. It preserves both scope workflows,
ordered separate drafting roles, edited-document lineage, explicit confirmation,
lost scheduler/client/Git acknowledgements, exact original recovery after actual
identity/factory restart, one native save, exact older-commit reopen and current
read-policy/Git-grant denial. There are still six synthetic model calls/reservations,
one encrypted candidate original and one native commit; all owned resources close.

## Measured result

Same 34-source joined case; these are synthetic fixture requests, not live GitHub
traffic. Durations are observations from one run, not a load or latency guarantee.

| Action | 0276 requests | 0277 requests | 0277 duration |
| --- | ---: | ---: | ---: |
| Candidate preview | 39,550 | 33,694 | 25,122 ms |
| Confirmation, discarded reply | 79,532 | 67,820 | 49,803 ms |
| Confirmation after runtime reconstruction | 79,470 | 67,758 | 49,532 ms |
| Identical confirmation replay | 79,468 | 67,756 | 52,979 ms |

Preview removes 5,856 requests (14.8%); each confirmation removes 11,712 (about
14.7%). Final source review remains 9,342 requests and drafting starts remain
41,768 / 47,350 / 47,350: this change is confined to historical composition.

The first confirmation's categories are 65,713 head, 709 commit, 709 tree and 689
blob requests, zero token issuance/mutation/other requests. Head reads are 96.9%
of its remaining traffic. The counter cannot attribute each head read to a
particular caller or distinguish authentication from corpus/destination checks.
This shows that object-body reuse alone cannot solve the remaining amplification;
it does not authorize a stale-head or permission-cache shortcut.

## Final verification

- **1,353 broad tests pass**, zero failed/cancelled/skipped, 140,812 ms with
  concurrency four. This includes three new direct-callback cases and the
  content-free metric test. All 20 current/historical-window checks also pass
  separately.
- Prototype and all eight package typechecks pass; five unchanged package checks
  use local Turbo cache. The optimized Next production build passes.
- The 95-artifact kit, read-only workflow-token audit, protected Architecture/Exam/
  accepted-retention hashes, 336 local links across eight changed/new Markdown
  files and diff whitespace checks pass.
- The architecture guide now explicitly labels its old readiness table as the
  0205–0206 snapshot and points to current delivery evidence. The workflow contract
  documents the current/historical read windows and owned workflow boundary.

No browser acceptance or live-provider test was run. The two focused SQL selections
above are not the full SQL suite. The user-owned `docs/REAL-USER-ROADMAP.md` and
`outputs/` remain untouched and excluded. The API-key skill's already resolved
credential boundary was preserved: no credential inspection/recreation or live
model call was needed.

## Remaining work and authority

Confirmation at about 50–53 seconds and tens of thousands of head lookups remains
unacceptable evidence for smooth live UX. The next safe engineering task is to
map and reduce duplicate caller barriers at actual read/return/effect boundaries,
preserving fresh revocation checks, rather than increasing deadlines or weakening
permissions. Independent authorization callbacks must never be treated as mere
duplicate guards. No change to live clock/policy/D1/model/write adoption or to
other-disposition and signed-in I1–I6 acceptance is implied by these tests.
