# Specification · development candidate

## Trusted composition

createMigrationCompatibilityVerifier accepts only a closed trusted context with
version steer-migration-compatibility-context/v1, the pinned executable model
digest, independently selected 0090 migration configuration bytes, sourceColumn
and targetColumn. Caller code, adapter functions or compatibility booleans are
not accepted. The model digest is the SHA-256 of dual-column.candidate.mjs.

The closed envelope binds context and policy digests plus actual graphBytes.
The complete exact migration verifier must pass first, safe non-result or exact
replay. All plan/before pins, source-byte preservation, backup/rehearsal, shared
authorization, contract human, provider post-state, journal/result and exact
time checks remain mandatory. Missing evidence does not become a model-only pass.

The manifest enumerates only schema-v1→v2 with app-v1/app-v2 and schema-v2→v3
with app-v2/app-v3. These are model coordinates, not verified production binaries.
Other tuples deny. Exactly one approved add-null-target, copy-source-to-target,
or drop-source operation must match the trusted column mapping and phase.

## Executable clients and preservation

Both versioned clients use an explicit compatibility shim. The old reader prefers
the source representation, falling back to the target only if the source column
is absent. The new reader prefers a non-null target, otherwise the source when
present. Writers mirror a value, including null, to every present representation.
This contract is not an assertion that existing application code already uses
that shim. Actual application and database adapters remain to implement/verify.

The model validates complete sorted data, rows and cells. If both representations
exist, the target may be unpopulated null or must equal the source. Conflicting
mirrors deny. Original logical row/value pairs must be identical before and after
the migration, so dropping an unpopulated replacement loses data and denies even
if the lower-level transform itself is valid. No row is sampled or omitted.

## Exhaustive bounded execution

For every row in both actual signed states, the harness executes all 24
permutations of old-read, old-write, new-read and new-write. After each operation,
both reader values and revisions must equal the latest accepted logical write.
Unrelated rows/cells, columns and schema identity must remain unchanged within
each client scenario. All scenarios start from independent copies of exact input.

Both clients also take the same row-revision snapshot. Each winner order is
executed: one write commits, the stale competing write rejects without mutation,
same-byte replay has no effect, different-byte key reuse rejects, and a fresh
revision/key retry succeeds. This is a synchronous row-CAS/interleaving model,
not multi-process database isolation or a durable replay store.

The derived trace contains actual read/write observations and final-state hashes,
with ordered row/state/scenario identities. Output binds its digest, full graph
digest, independently verified migration evidence digest, executable model and
policy. Two rows produce 104 cases; 128 rows produce 6,656. Labels alone cannot
provide observations. Outputs are fact-only with liveCompatibilityVerified=false,
executionAuthorized=false, zero effects and journalEffects=0.

## Bounds and remaining work

Context is at most 32,768 UTF-8 bytes; envelope 16,777,216; each model data payload
65,536. Data has at most 32 columns, 128 rows and 4,096 UTF-16 units per cell,
with the tighter UTF-8 payload bound still enforced. A model holds at most 256
committed command keys; overflow fails before mutation and old exact replay
remains effect-free. Existing full migration limits also apply.

This covers only the pinned dual-column model, finite four-operation permutations
and one selected row per isolated scenario. Cross-row transactions, actual app
versions, live database/tenant/RLS concurrency, multi-batch chain continuity,
crash cuts and durable checkpoint/replay behavior are not proven. Neither this
model nor the lower-level graph can authorize real contract cleanup. Normative
matrix completion and independent/protected review remain open.
