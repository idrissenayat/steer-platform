# Controlled recorded projection recovery

Increment 0181 provides an **internal primitive**, not an enabled command or live
permission. It uses the current stack and preserves normal recorded dispatch.

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

## Still to implement before use

Add a separate current `workflow.recorded-brief.recover` permission, exact configured
plan binding, an owned one-attempt/uncertain-acknowledgment client and truthful status
through the shared API/MCP runtime. Saving, ordinary dispatch and ingestion grants
must not substitute. Actual disposable identity/browser integration and approved
live configuration are later acceptance steps. No public tool or live recovery is
enabled by 0181. All five R5 findings and independent/qualified review/human gates
remain open; recovery never grants save, signature, release or spending authority.
