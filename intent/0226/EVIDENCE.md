# Development evidence — 2026-09-08

Base: `e57746a153cfd6f5e0fefe060b6237d488bf9c4b`.

## Implemented boundary

The actual Next.js intent editor now contains explicit working-draft preservation,
exact-request recovery, conflict review and preview-before-replacement restoration.
Only validated server acknowledgements identify preserved revisions; current
typing is compared separately. Restored documents do not fabricate generation
provenance or restore scope/review/gate authority. Server draft revision and local
document edit version are labelled separately. Original clarification turns are
retained exactly; recorded conversation continuation remains unconnected.

The transport uses the 0225 API contracts directly. Tests compile the production
React graph, use the real transport/controller, and substitute only synthetic HTTP
responses. This is not another application or preview. The display switch remains
off; no real records service is installed and no real UI persistence is claimed.

## Verification

**130/130** checks pass: 119 web regressions, nine architecture boundaries and two
real-migration hold controls. These include nine draft-controller cases, eight
transport cases, a production-component DOM journey and the default-closed product
display configuration. The DOM journey verifies keyboard focus, preservation of
newer typing, exact lost-response retry, conflict/cancel/restore, all clarification
turns, inert Markdown and scope/hide clearing. Its axe WCAG 2 A/AA subset reports
zero violations with color-contrast disabled; existing design-token contrast tests
also pass. This is automated structural evidence, not full visual accessibility.

Full prototype/eight-package typecheck, optimized Next.js production build, kit
validation (95 required artifacts), token-scope audit and whitespace checks pass.
No SQL integration was rerun for this browser-only change; the prior 0225 HTTP-to-
encrypted-SQL evidence is a separate historical result, not counted here.

Protected SHA-256 values remain unchanged:

- Architecture: `9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65`.
- Canonical Exam: `84ad1d4c14d6614fe4b53509104e379e9ad6dff0462c96109901eefb1e02fd7f`.
- Accepted records policy: `f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32`.

## Limits and next work

Automated DOM checks are not real-browser visual QA or actual signed-in API-to-SQL
acceptance. Owned-draft listing/recovery after refresh is not yet connected; the
current control requires a known reference. In-page uncertain request IDs are
cleared by the existing memory-only policy, not persisted in browser storage.
The recorded-development start/status/result API/editor path must be connected
before resuming restored multiple-turn conversations or accepting I1–I6.

The API-key skill preserved the resolved credential decision. No secret was read,
created, changed or used for a model call. No real environment, migration, grant,
policy, runtime Git writer, deployment, release, deletion or paid usage changed.
The D1 amendment stays unsigned/inactive, and all live journey acceptance stays open.
