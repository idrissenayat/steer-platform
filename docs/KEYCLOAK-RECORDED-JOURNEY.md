# Actual Keycloak dispatch in the recorded-Brief journey

Increment 0178 replaces the direct SDK start in the disposable browser-created
Brief journey with authenticated dispatch through the production identity runtime.
The same local Keycloak instance now authenticates the human browser session and
issues fresh tokens for the separate, hat-free dispatcher service account.

The owned native Git source holds separate human and dispatcher authorization
records. A projection-only dispatcher grant denies start before any attempt; an
explicit recorded-dispatch grant permits the fixed operation once. After actual
Temporal completion, Git-committed revocation denies dispatcher status even with a
fresh provider token. Restored current permission restores read access, not a second
start attempt or a new save.

Queued worker-runtime reconstruction precedes the first human browser receipt read.
The production recorded worker verifies the actual native Git operation/artifact,
projects into disposable PostgreSQL and preserves exact revision/content in the
browser's recorded-source view. Replay and duplicate rejection retain a single
ingestion event. Human/dispatcher subjects, content and credentials stay outside
workflow history.

## Ownership and evidence

Test-only dispatch inputs pass explicitly from the browser harness to the owned
PostgreSQL harness. That owner supplies its generated database/encryption material
to the production identity runtime; it never exposes them to workflow arguments.
The Temporal harness transfers only its separately owned managed connection. The
bearer-only test runtime performs no browser login/token exchange using its unused
placeholder browser client secret. The actual generated service-account credential
remains inside the existing Keycloak token supplier.

Execution results: `intent/0178/EVIDENCE.md`. This adds no production configuration
or frontend design change. Gate authority, projector principal and GitHub response
adapters remain synthetic. Neither actual provider authentication nor a passing
local browser test supplies governed selection/review provenance, complete write
authority, approved source admission, independent review or a human gate signature.
All five R5 findings and the real approved-pod journey remain open.

Next bind current projector identity in this same disposable journey and retain
independent dispatch, receipt-reader and ingestion permissions. Live configuration
and complete governed saving remain separate approval-bound work.

0179 adds that separate actual projector identity in the same local journey; see
[projector identity](PROJECTOR-IDENTITY-JOURNEY.md) and its execution evidence.
The 0178 evidence above remains historical and does not itself prove this extension.
