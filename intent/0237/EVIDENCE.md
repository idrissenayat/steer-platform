# Development evidence — 2026-09-08

Base: `14c05170b51d5ed54b42c1a1650207516462c632`.

## Implemented

Immutable encrypted scope request/response observations with provider-free request
verification and mandatory exchange verification; exact source/preparation/owner/
reservation binding; request-digest-linked responses; explicit uncertain-state
readback without retries; and SQL insert-time serialization with batch transitions.

## Verification

**1,038/1,038** combined registry/data/adapter/agent/API/worker/web/domain and
package/migration-boundary checks passed on Node 24.19.0. The six recorded-scope
SDK tests include provider-free exact request verification and rejection of changed
batch, wire, permissions and allowed-model profile without network access.

All **11 new scope-observation checks** passed against the actual PostgreSQL store
and recorded Mastra SDK with synthetic responses: exact Unicode/raw-byte restart
recovery and one reservation; lost request ACK preventing transport; lost response
ACK recovered after quarantine; concurrent immutable replays and altered wire/
citations/usage/ownership; missing originals and uncommitted dispatch; forced RLS,
denied roles/mutations and strict SQL bindings; quarantine winning after adapter
preflight; current records/source/key/hold revocation; ciphertext substitution and
close during verification; mandatory void acknowledgement and review expiry; and
temporary-relation shadowing, later human edits and known-failure readback.

The final non-overlapping full rerun passed **241/241 PostgreSQL integration
checks on PostgreSQL 16.14**, including all 11 new checks above, legacy encrypted
drafting, actual disposable Temporal and native-Git fixture paths. All 27 migrations
apply twice without replay effects. This run removed only its own synthetic database.

Prototype and all eight packages pass typecheck. The optimized Next.js build,
Drizzle migration-history check, kit validation (95 required artifacts), workflow
token-scope audit and whitespace checks pass. The real-local migration preflight
still restricts operational state to its previous approved baseline. The new
migrations are used only by disposable synthetic database fixtures.

## Validation findings

The fixture initially calculated the response's request digest from its own object
field order; it now consumes the acknowledged storage digest as required. Test pool
cleanup now skips already-ending owned pools so cleanup does not mask assertions.
Only these tests' own synthetic PostgreSQL containers/tmpfs were removed; no real
application records or user files were deleted.

One rerun, which began while an earlier full integration job was still running,
returned `attention-required` instead of `needs-clarification` in the existing
Temporal clarification case. Earlier full runs and the non-overlapping scenario
recheck passed. The cause is **not confirmed**. Keep this as a reliability follow-up
before live acceptance; the passing rerun does not erase it. Added failure diagnostics
contain only outcome, synthetic call count and observation count. No source bodies,
credentials, relaxed assertion, longer production deadline or automatic retry added.

Protected SHA-256 values remain unchanged:

- Architecture: `9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65`.
- Canonical Exam: `84ad1d4c14d6614fe4b53509104e379e9ad6dff0462c96109901eefb1e02fd7f`.
- Accepted records policy: `f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32`.

## Limits

Uninstalled adapter; current unexpired review required for observation reads.
Successful checkpoints, expired observation recovery, Temporal and real authority
binding remain next. All model responses, grants, keys and budgets are synthetic.
The API-key skill preserves the existing credential decision. No real D1 records,
migration, model spend, runtime Git save, gate, release or deployment is enabled.
The signed Architecture, canonical Exam and accepted records policy are unchanged.
