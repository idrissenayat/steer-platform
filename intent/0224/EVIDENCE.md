# Development evidence — 2026-09-08

Base: `376e771525c837c21fa366405171df5e6aaaa438`.

## Implemented

Reference-only `developIntent`, strict fixed-operation activity, dedicated worker,
no-retry start, content-free progress and bounded cancellation. Actual private data,
authority and dispatch/checkpoint logic stay in the 0219–0223 SQL/model composition.
There is no actual-application service registration.

## Verification

**178/178** disposable integration checks passed, including nine new actual Temporal
checks for both-role completion, stored Architect checkpoint reuse, deterministic
history replay after worker recreation, duplicate starts, clarification, newer
edits, held drafts, uncertain output, foreign references and cancellation before/
after dispatch. Cancellation after request capture retains uncertainty and prevents
late response capture or another provider send.

**325/325** scoped units/migration controls pass: domain 27 + registry 170 + data
53 + agents 15 + worker 58 + migration boundary 2. Six new worker checks cover
strict contracts, start/queue policy, fixed binding, sanitized failures,
cancellation, deadlines, late work and explicit close. Full prototype/eight-package
typecheck, required kit (95 artifacts), token-scope and whitespace checks pass.
**33/33** existing Temporal regression checks also pass, including older projection,
recorded Brief, recovery, gate-watch and owned API-to-Temporal paths. These existing
tests are distinct from the nine new development cases in the 178-check suite.

Architecture-boundary verification initially exposed an outdated import allowlist
for 0205–0223 composition files as well as the new deterministic workflow contract.
The detector now reports all violations at once; reviewed exceptions are exact
composition files/specifiers, not package-wide provider access. Negative tests
retain provider-free workflow contracts and generic activities, recorded-only model
access and browser-only portable contracts. **9/9** boundary checks pass.

The first clarification integration fixture contradicted the role schema by
returning questions with completed documents. The runtime rejected it; the fixture
was corrected to null documents rather than weakening production validation.

The integrated fixture uses actual local Temporal, PostgreSQL, encryption and the
installed Mastra SDK. Fetch responses, records keys, identities and grants are
synthetic. It does not contact OpenAI or the local model gateway.

Official [Temporal activity options](https://typescript.temporal.io/api/interfaces/common.ActivityOptions)
and [retry policy](https://typescript.temporal.io/api/interfaces/common.RetryPolicy)
were consulted for cancellation/heartbeat and one-attempt configuration. No SDK
upgrade or new dependency was required.

## Non-claims

History replay is not a real process-crash recovery drill or authorization to reset
a failed workflow. SQL checkpoint reuse is not permission to replay an uncertain
provider call. A completed workflow can return attention-required or clarification.
Live authority, cost/quality validation, D1 adoption, provider reconciliation, actual
editor/API recovery and I1–I6 user acceptance remain incomplete.

No real migration, credential/grant change, paid model call, runtime GitHub save,
deployment, deletion or signed-source modification. User roadmap/outputs excluded.

Protected SHA-256 values remain unchanged:

- Architecture: `9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65`.
- Canonical Exam: `84ad1d4c14d6614fe4b53509104e379e9ad6dff0462c96109901eefb1e02fd7f`.
- Accepted records policy: `f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32`.
