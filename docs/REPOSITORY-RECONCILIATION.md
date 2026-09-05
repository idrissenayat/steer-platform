# Bounded repository reconciliation

reconcileArtifacts in @steer/adapters/reconcile takes a trusted code-host reader,
an explicit 1–100 path manifest and a projection sink. It sorts paths, pins one
Git revision, checks source binding/hashes and stages up to 8 MiB of content
(512 KiB per file). No ingest begins unless every source file has passed. Missing
files are failures, not instructions to delete or silently skip projections.

HEAD is checked after staging, before each write and at completion. Each write
uses existing expected-revision CAS and immutable event history. Results include
revision, status (reconciled or superseded) and each path's applied, duplicate,
repaired or superseded outcome. A superseded manifest is not a successful reset.

## Partial results and recovery

This is not an atomic repository transaction. An error after one write leaves that
write in place. ReconciliationError contains a generic message, code, revision
and acknowledged count, never artifact/provider/SQL error content. A lost commit
acknowledgement can leave more committed records than that count indicates.
Do not interpret it as a rollback or automatically retry the transaction.

A later explicitly requested reconciliation reads current Git again and relies
on CAS/idempotency/repair to converge. It can skip intermediate source revisions
because the projection is rebuilt from source, not from inferred event deltas.
Previously seen superseded revisions are not silently allowed to overwrite newer
projections after a branch reset. Source removal, rollback policy, full inventory
and atomic-manifest publication remain separate requirements.

Cancellation stops new work at operation boundaries. Existing provider/database
operations must settle before shutdown completes; there is no cosmetic timeout
that hides active work. Existing provider/pool/SQL budgets apply, but this function
does not promise a single total deadline or cancellation of an uncooperative
custom transport. HEAD can move immediately after any check; reported revision
is explicit, not a perpetual current-HEAD claim.

## Explicit runtime

createProjectionRuntime in apps/api/src/runtime.ts takes a strict versioned
steer-projection-runtime/v1 profile with github (appId and binding), database
transport and paths, plus separate githubPrivateKeyPem/databasePassword secrets.
It constructs the actual GitHub restricted reader and steer_projector pool.
No environment discovery, timer, HTTP job route or provider is enabled by default.

Supply a trusted authenticate callback that verifies the agent independently.
It must return a current same-organization agent with no hats and projection.ingest.
The runtime checks it before source reads and freshly before every storage
operation; subject switches deny. This callback is an infrastructure seam, not
request input or permission to fabricate an agent principal. Authority can change
after any check; an in-flight database transaction is not atomically coupled to
the external identity source. No governed Git write or human signature is offered.

runOnce rejects overlapping calls. shutdown closes admission, requests cooperative
cancellation, awaits actual work and closes the owned bounded pool. status exposes
only lifecycle and content-free pool state. A run failure remains a failure even
if its resources later close successfully. A real authenticator and approved secret
binding are required before live activation; none is configured by this increment.

## Evidence and limits

The browser harness uses a two-file synthetic Git manifest, real PostgreSQL and
the production reconciliation/ingestion adapters. Repeated runs yield duplicates;
repair of an owned corrupt projection leaves event count unchanged. Both files
are read back byte-for-byte, including trailing newlines. The existing authenticated
browser reads one of these projected artifacts. Runtime tests separately verify
lazy configuration, agent denial, overlap refusal and actual pending-work shutdown;
they do not claim a live provider-connected runtime factory pass.

See intent/0032/EVIDENCE.md. This completes explicit-manifest replay, not automatic
whole-repository discovery, deletion/pruning, durable workers, production deployment
or Gate 2. Git remains authoritative; projections remain disposable.
