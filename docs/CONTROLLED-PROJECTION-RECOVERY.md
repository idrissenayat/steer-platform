# Controlled recorded projection recovery

Increment 0181 provides the internal primitive. 0182 adds separately granted shared
command/status definitions and an owned dispatch client. Both remain unavailable
without explicit service configuration; no live recovery permission is installed.
The current stack and normal recorded dispatch are preserved.

## Exact reference and lifecycle

The plan binds the original organization/repository/item/save-operation ID and the
exact failed original run ID. It derives a separate `steer-recorded-brief-recovery/v1`
workflow identity. This is a reference-linked workflow, not Temporal child-workflow
ownership or reset. It does not change the saved operation, original history or
original FAILED status. Normal start continues to reject duplicates.

A dedicated recovery queue runs one bounded activity attempt. Concurrent starts for
the same failed original converge on one retained recovery identity; completed or
failed recovery cannot be started again under that ID. No recursive recovery chain,
automatic activity retry, arbitrary round count or caller-selected effect is added.

## Current failed-run and projector checks

The fixed guard describes the **current** original workflow rather than selecting a
historical run. It requires exact namespace, original ID/type/queue, failed run ID and
FAILED status. Missing, unavailable, replaced or differently terminated work denies.
Routing and plan are snapshotted before asynchronous dispatch work.

The worker does not trust start-time inspection. Its separately supplied trusted
parent adapter is bound to the same plan and checked before and after each current
projector authentication around receipt, source and SQL work. Current projector
permissions, receipt owner/operation, exact artifact checks and idempotent SQL CAS
remain those of the existing recorded worker. A changed parent or revoked projector
denies further work; it does not retroactively roll back a committed effect.

The parent connection is owned by its explicit caller. The recovery runtime owns its
bounded pool and drains active work before closure. Do not share a transferred
dispatch connection with that worker guard or treat arbitrary callbacks as governed
configuration. Approved adapter/identity/queue ownership remains separate.

## Observable recovery and limits

The local integration covers a failure before SQL and a failure after SQL commits
but its activity acknowledgment is lost. Recovery must return applied in the first
case and duplicate in the second, with one exact ingestion event and unchanged
source content/revision. Concurrent duplicate starts, queued runtime reconstruction,
history replay, wrong binding and current grant denial are also checked. Exact run
results are in `intent/0181/EVIDENCE.md`; synthetic provenance limits remain explicit.

Temporal/Git/PostgreSQL checks are not a cross-system transaction. A late revocation,
parent change or transport loss can leave unknown/applied state requiring readback.
Retention of workflow IDs bounds duplicate enforcement; no eternal uniqueness claim.
If recovery itself fails, this first bounded primitive stops rather than recursively
restarting. Additional recovery policy needs an explicit contract.

## Separate shared command and owned client — 0182

`workflow.recorded-brief.recover` requires its separate current hat-free agent grant.
`workflow.recorded-brief.recovery.status` requires its own current human/hat-free-agent
read grant. Saving, ordinary dispatch/status, ingestion and human hats cannot
substitute. Both bind the exact configured original target/failed run and derived
recovery ID. Current identity and binding are checked before work, and again after
status reads. Already accepted effects cannot be undone by later revocation.
These shared grant checks precede managed parent inspection/start; they do not create
a durable authorization lease across asynchronous Temporal/Git/SQL operations.

The owned client snapshots trusted routing/plan, admits one active operation and
latches one start attempt before failed-parent inspection. Parent uncertainty,
acknowledgment loss, malformed output or duplicates do not release that latch.
Only the SDK's typed not-found response means absent, and absence never unlocks
retry. Status describes the exact recovery, independently of parent eligibility;
COMPLETED is not proof of SQL success. Shutdown drains actual work and closes only
its separately transferred connection, never the worker guard's connection.

Shared HTTP/OpenAPI/MCP definitions preserve validation and annotations with no
default service. Exact verification is in `intent/0182/EVIDENCE.md`. Instance-local
one-attempt admission relies on retained server identities across reconstruction;
this is not perpetual deduplication beyond Temporal retention.

## Optional authenticated runtime — 0183

The identity profile optionally declares `recordedRecovery` with an exact item,
save-operation ID and failed original run. `createRecoveryScheduler` must be
explicitly paired; organization/repository come from the configured Git reader.
The complete factory plan, derived workflow ID and methods are validated before
registration. No factory/profile means no recovery service. No live profile changed.

The runtime owns this separately transferred scheduler and its lazy session pool.
It drains real requests before closing resources even when recovery is its only
managed service and MCP is absent. New work is denied while draining. All independent
resources receive cleanup if one fails, with sanitized errors and no reopening.
Factories must clean failed allocations before rejecting; successful transfers are
the runtime's responsibility. Worker/parent connections remain separately owned.

The local integrated test joins signed synthetic recovery identity/current native
Git grants to the actual API runtime, SDK connection, failed original workflow and
exact Git/PostgreSQL projection. Recovery and projector subjects/grant records are
separate. It checks grant substitution/revocation, queued runtime reconstruction,
duplicate admission and exact one-event ingestion. Results and provenance limits:
`intent/0183/EVIDENCE.md`. This is not actual Keycloak recovery acceptance.

## Actual disposable Keycloak — 0184

`pnpm --filter @steer/api test:recovery:integration` runs an exclusive `--recovery`
mode against the already pinned disposable Keycloak image. It adds a recovery-only
service account with credentials and subject distinct from the projector, obtains
real tokens over run-pinned HTTPS, and reuses production OIDC/current Git validation.
No environment discovery, live credential fallback or real account installation.

The same failed-run recovery test now covers actual provider-token substitution,
human-hat/substitute-grant denial, projector revocation after receipt readback before
SQL, runtime/connection reconstruction and exact one-event recovery. Current recovery
revocation does not revoke the separate projector. Temporal, SQL and issuer ownership
stay distinct, and cleanup targets only the run's generated resources. Exact results:
`intent/0184/EVIDENCE.md`.

This dedicated suite still uses synthetic GitHub responses and receipt provenance.
It is not the browser-created operation's recorded-receipt demonstration; the normal
Temporal regression suite retains its synthetic issuer mode. No production code
path or live configuration was added by this test increment.

## Browser-created receipt integration — 0185

`pnpm --filter @steer/api test:recovery:browser` adds a separate `--browser-recovery`
mode. Like the existing browser command, it requires the actual prebuilt Next app
(`pnpm --filter @steer/web build`). The ordinary `--browser` success path remains.
An additional disposable account supplies recovery identity; it cannot borrow the
human, normal dispatcher or projector identity. The source is the browser's actual
save/status operation in native Git, not a seeded recovery receipt.

The scenario fails the original activity through current projector revocation after
browser receipt readback, before SQL. Recovery uses the exact failed run and a
separate owned queue/client/runtime. It tests current grant/token/plan denial,
queued reconstruction, retained duplicate rejection, one SQL event, original FAILED
preservation, history replay and exact browser Brief readback without a second save.
Verification status: `intent/0185/EVIDENCE.md`. Full gate authority and GitHub
responses remain test doubles; passing this test is not real governed acceptance.

## Still required before use

Approved live configuration, trusted receipt access and source admission, complete
governed action-time authority and qualified evidence remain separate prerequisites.
No live recovery is enabled by these increments. All five R5 findings and
independent/qualified review/human gates remain open; recovery never grants save,
signature, release or spending authority.
