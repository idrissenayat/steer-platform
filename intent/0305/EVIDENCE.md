# Owned records reader: verified native composition, not installed workflow

The internal production-source reader replaces the storage portion of the
test-only read-set. It imports no test code and is not wired into the application
factory. It retrieves metadata before ciphertext, requires a distinct policy for
every record group, compares the exact authorized metadata with retrieved rows,
and preserves every complete row and lifecycle in final readback.

The trusted verifier must perform its own key, cryptographic, SDK and retained-
source checks. It must await the one-use records recheck before the corpus graph's
final source closure. The owner checks current caller/all-record-grant revision
through return. This contract is not a replacement for real policy providers or
records adoption, and the callback cannot contain a model dispatch or save effect.

Four operations may be admitted. Cancellation/close withholds results promptly,
but occupied slots remain until actual connect, SQL, policy, verifier and pending
recheck work settles. Shutdown drains that work. First-seen draft/candidate expiry
can shorten but never extend; invalid/backward clocks latch denial. Existing
runtime roles, row locks, RLS settings, server query limits and lease cleanup remain.

## Verification and corrections

Thirty focused tests pass: fifteen new owner/schema/policy groups, ten existing
prototype read-set groups and five diagnostic-selection groups. They cover every
independent metadata policy before ciphertext dispatch, exact target membership,
role/tenant/subject/product checks, overflow/duplicate/missing rows, stale metadata,
late policy/ciphertext/operation/hold/grant changes, mandatory awaited recheck,
invalid/expired clocks, and held connect/SQL/verifier/recheck drainage.

The first package typecheck found an overly broad `Object.fromEntries` cast. It
was replaced with explicit group-keyed projection. The first native run completed
the unchanged application save/recovery/reopen, then the new reader rejected the
records snapshot. The reader incorrectly required a model budget on candidate-save
steps; their native contract requires null. That was corrected without changing
the schema or granting model usage. The fixture now also matches operation/step
tables' organization/subject ownership rather than inventing a product column;
those rows retain exact draft/operation linkage and independent product-scoped
policy context. The new budget regression rejects null/wrong budgets for model
steps and non-null budgets for candidate-save steps.

The corrected native rerun passes the preceding authenticated application journey,
the new reader's complete assertions and idempotent migrations. The 15 independent
group denials all occur before decoding. Late record/key/source loss, expiry, a
new draft revision and a hold reach their intended boundary and reject. Prototype
and all eight package typechecks pass (five cached, 2.39 seconds). Kit validation
and workflow scope audit pass. No full integration-suite or real UI run is claimed.
Commands, failed-run history, final samples and hashes are in
[VERIFICATION.json](VERIFICATION.json).

## Measured scope

The owned records/corpus portion uses **56 simulated provider attempts**: 12 source-
repository, 43 identity-provider and one JWKS. It performs 38 caller checks, 13
metadata grants, 80 independent record policies, 136 retained-source policies and
252 revision/path grants. There are six role transactions and 51 SQL statements:
metadata first, initial complete contents, final complete contents. One physical
key is checked twice. The unchanged crypto/SDK oracle verifies 20 encrypted rows,
four scope exchanges and both development roles across two revisions/three original
contexts. Each revision retains 34 semantic sources and 42 physical paths.

The single undelayed 1,592 ms sample and 607,626 snapshot bytes are not a p95
measurement, accepted budget or application speedup. Independent policy services
and the decoder are still synthetic/test-only. The preceding actual application
confirmation/recovery/repeat remain **7,637 / 7,609 / 7,607**. A production-source
reader is not the same thing as an installed application workflow.

## Remaining work

The production decoder/key-policy composition and actual factory/outer effect
integration remain. The test decoder continues to be a test-only oracle; it is
not promoted by removing its label. Complete the unchanged full C22 benchmark
after integration, then pursue the distinct live records/model/GitHub/UI checks.
No new deadline, approved component allocation or resolved 0289 recovery cause is
claimed. The actual application path still uses the old readers.

The API-key safety skill kept the resolved credential boundary intact. Only local
synthetic fixtures were used; no credential was read, model called, money spent,
real runtime GitHub save made or records adoption/deployment performed. Test-run
cleanup removes only its owned disposable PostgreSQL and Git fixtures. User drafts,
roadmap/outputs and signed documents remain untouched. **68% (17/25; eight remaining;
+0 percentage points).**
