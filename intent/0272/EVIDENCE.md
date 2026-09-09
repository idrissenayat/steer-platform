# Development evidence — 2026-09-09

Base: `a4c85e59e59ef92f77264d4464bba36ccf069e4b`.

## Implemented

`createOwnedIntentJourney` constructs all 21 actual journey services and the
internal publication recorder in the existing API composition root. It validates
one records home, publication scope, shared scope/drafting budget, scope-profile
digest and separate execution actions before returning a managed inventory.
Current/native source review and recorded current/historical readers are wired
internally; preserved role profiles derive from the same SDK profiles used to
verify them. Fixed schedulers and every current authority remain explicit ports.

Provided resource cleanup is pinned and awaited once. Services close in reverse
construction order; failed construction closes prior allocations and resources.
The existing corpus-review constructor also now closes its collector if child
review construction fails. No architectural import exceptions are broadened.

## Verification

Initial factory tests caught an incorrect test expectation: denied draft creation
returns unavailable, not unknown. Fixture typing caught an omitted native-reader
method and invalid optional-field assignment. Those tests were corrected without
weakening production contracts. A first joined SQL attempt caught a test-only
pluralized draft-discovery tool name (404); the registered name is now used.

The first concrete factory/discovery integration passes both joined checks plus
idempotent migration verification. A second run also passes native current corpus
review: authenticated requests restore exact encrypted draft bytes, list actual
SQL metadata through all four discovery services, and verify the two native Git
Brief/Spec sources at the current commit. Revoked corpus permission withholds the
source response. All four concrete-owned database pools finish shutdown across
the two runtime instances. The original inventory-only regression is preserved.

The focused suite is explicitly not the full SQL suite. Signed identities,
records/source selection and all other policy callbacks are synthetic. There is
no model transport, budget provisioning, semantic verdict, generated document
claim, workflow dispatch, live GitHub mutation or publication-retention effect.
Temporary SQL/Git fixtures are cleaned up; user data and real services are untouched.

The initial broad regression command passes 1,325 tests with zero failures, skips or
cancellations (144,695 ms). Prototype and all eight package type checks pass, as
does the optimized Next production build. Kit validation passes all 95 required
artifacts and the workflow token-scope audit retains read-only contents scope.
Protected Architecture, canonical Exam and accepted retention-candidate SHA-256
hashes remain respectively `9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65`,
`84ad1d4c14d6614fe4b53509104e379e9ad6dff0462c96109901eefb1e02fd7f` and
`f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32`.
After the final distinct-pool/native-reader validation, all 34 focused tests pass
(5,254 ms), and the focused SQL run again passes both joined checks plus idempotent
migration verification. Its process exits successfully and removes only its own
synthetic PostgreSQL container/tmpfs data. The final prototype/eight-package type
checks and optimized Next production build also pass. All 341 local Markdown
links in the nine changed/new documents resolve; `git diff --check` passes.
The final broad recheck after that guard passes all 1,325 tests with zero failures,
skips or cancellations (140,574 ms).

## Remaining work

The complete API constructor graph now exists; its worker/scheduler/resource and
policy services still require governed bindings. Extend the previously joined
recorded scope/SDK/Temporal package through this concrete authenticated factory,
including confirmation, fixed save and exact reopen. Then complete actual clock
provenance/constrained late recovery, D1 adoption, approved model budget and provider
write authority before signed-in human acceptance. No real activation is inferred
from this factory or its synthetic tests. Signed documents, credentials and the
user-owned roadmap/outputs remain unchanged.
