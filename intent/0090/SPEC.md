# Specification · development candidate

## Explicit exact-time profile

createMigrationTimeVerifier delegates to createExactMigrationGraphVerifier in
0062. Both the original and exact factories use one private composition body.
The new factory accepts only steer-migration-context/v2 and its graph accepts
only steer-migration-graph/v2 with the selected exact policy digest. The digest
binds the original policy, 0069 exact-time policy and new chronology semantics.
Neither incoming evidence nor a legacy context can switch the selected profile.

The original factory, v1 policy, whole-second grammar and output shape remain
unchanged. No frozen artifact, trust anchor or shared action manifest is edited.

## Chronology

Every outer migration time uses 0069 exactInstant: whole seconds or exactly nine
fractional UTC digits, real calendar dates and bigint nanosecond arithmetic.
There is no default evaluation clock, timezone conversion or fractional rounding.
Source age is at most exactly 300 seconds; a record one nanosecond older denies.
Plan validity remains half-open: evaluation equal to validThrough denies.

The same precision applies to plan/before/backup/rehearsal ordering, qualified
contract approval, authorized request and reservation, rollback/restoration,
provider post-state, journal, final result and replay observation. Existing strict
versus non-strict comparisons are preserved. Shared signed-record, human and
action verifiers continue to enforce their complete native/current-time checks.

## Unchanged complete evidence path

The trusted approved definition/before-state pins, actual bounded transformation,
all six opaque governance byte payloads, complete backup/rehearsal, full contract
human bundle, all ten shared action records, selected provider post-state and
independent journal/result lineage remain mandatory. Complete rollback and replay
must still prove the same actual supplied truth and result, not caller flags.

All exact-profile success and failure outputs explicitly carry
executionAuthorized=false, zero effects and journalEffects=0. An observed effect
count describes supplied synthetic evidence only; no SQL or journal write occurs.

## Remaining boundaries

This is still the bounded single-step evidence model. It does not prove real
old/new reader/writer compatibility, concurrent transactions, multi-batch
checkpoint recovery, live provider behavior or future migration trust rotation.
Other public precision paths and complete normative coverage remain to reconcile.
All five R5 findings remain formally open for independent/protected review.
