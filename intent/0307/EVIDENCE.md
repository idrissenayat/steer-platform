# 0307 — Production SDK and recorded-history verification

The [production API composition](../../apps/api/src/recorded-history-verifier.ts)
now uses actual SDK wire verification, the existing role renderer and canonical
operation/worker schemas within the owned content reader. The test-only crypto/SDK
oracle remains an independent comparison; it is not imported by production code.

Scope requests match exact prepared batches, and responses match their request,
profile, raw SDK body, parsed findings and durable worker ownership/checkpoint.
Missing planned batches remain incomplete. Development requests match the retained
original and exact step input; their responses and result records must agree with
the worker checkpoint. Recorded scope bindings are joined to the exact verified
review, source revision, inventory, head and assessment used by the drafting run.

The Test Agent predecessor is built only from a verified, succeeded Architect
checkpoint. Existing request rendering excludes inherited Exam/chat state and
preserves the original source/corrections. An Architect asking questions cannot
have a fabricated Test Agent successor. A stored response without a succeeded
checkpoint stays explicitly incomplete; no result, retry or execution permission
is manufactured from it.

## Verification scope

The explicit command is `node packages/data/test/postgres.integration.ts
--owned-history-readset`. It runs the existing authenticated HTTP/Temporal/native-
Git save/reopen journey and then the new production content/history composition
with native corpus verification. Exact measurements, assertions and source hashes
are recorded in [VERIFICATION.json](VERIFICATION.json).

The final native run passes all 37 SDK/lineage isolation cases and the inherited
early-group and late records/key/source/expiry/revision/hold denials. Four scope
and two development SDK exchanges are verified from 20 decoded records. This
portion uses 52 simulated provider attempts, 51 SQL statements, 80 record policies,
40 key policies and two physical key reads. The single undelayed 1,652 ms sample
includes an independent test oracle with 20 extra decodes; it is not application
p95. Actual application confirmation/recovery/repeat remain 7,637 / 7,609 / 7,607.

All 44 final focused tests, prototype/eight-package types, 95-artifact kit and
workflow token-scope audit pass. Earlier native runs passed before the final
cross-review lineage check and its additional cases; their smaller scope is
recorded separately. The full suite, build and browser were not run for this
increment. No new SDK dependency or wire/storage format was introduced.

The isolation cases mutate copies after synthetic authorized decoding to exercise
SDK/lineage rejection, not crypto integrity or live authority. They include wrong
scope/operation bindings, profile/body changes, owner/reservation/checkpoint changes,
duplicate/orphan records, a forged Test Agent predecessor, pending work, unknown
request outcomes, captured but uncheckpointed responses, clarification and
cancellation. A fetch-denying check verifies the reader has no provider transport.
The native composition separately keeps actual key/records/source closure intact.

## What this does not complete

SDK consistency is not provider authorship, semantic quality, current source
permission, approved profiles, execution authority, candidate-save verification or
a gate. Output flags retain those distinctions. Current records/source/key/hold
authority still belongs to the enclosing authorized read. Historical input lineage
does not satisfy a current admission or authorize a new model request or save.

The actual application factory/public tool path is not switched. Stage-appropriate
authorized target discovery, current-versus-historical public projections and the
effect-separated application binding remain. Bind the shared readers to actual
services next, then run the unchanged whole-action C22 protocol. The isolated
portion's provider count and undelayed timing are not accepted application latency.
Live model quality, records adoption, real runtime save and signed-in human UI
acceptance remain separately required; no new deadline or budget allocation is made.

The API-key safety skill kept all work synthetic. No real key was read/recreated,
model called, money spent, live runtime GitHub save made, records adopted, app
profile activated or deployment/signature performed. Disposable test cleanup is
limited to the run's synthetic data; user drafts, signed documents, roadmap and
outputs remain untouched.

**Intent capture: 68% (17/25; eight remaining; +0 percentage points).**
