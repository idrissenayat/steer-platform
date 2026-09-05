# Authorized reconciliation scheduling

Increment 0039 exposes the existing bounded reconciliation workflow through two
canonical tools. Git remains authoritative; a completed workflow means only that
its reconciliation rounds completed, never that a gate was signed or passed.

## Explicit composition

The registry's optional ToolServices.reconciliationScheduler accepts a trusted
fixed-scope scheduler. createReconciliationSchedulerClient in apps/worker/src/client.ts
adapts an already authorized Temporal Client plus namespace, taskQueue, scope,
maxRounds and minIntervalMs. It validates the namespace matches the supplied
client, copies/freeze-binds configuration and computes the existing escaped ID.
The caller owns the connection lifetime and must drain tool requests before
closing it. No new connection, credentials, environment loader or default CLI
activation is added. The combined identity bootstrap does not yet compose this
connection; explicit API/MCP ToolServices injection is the current integration seam.

Only the adapter imports Temporal. The registry depends on its structural port;
its schemas, grants, dispatch and errors are shared by internal calls, HTTP and
MCP. An authenticated call without a scheduler or revalidator returns unavailable.
Cluster namespace/task-queue ACLs and server authentication remain required before
live deployment; fixed app routing is not evidence of cluster-side enforcement.

## Calls and authority

workflow.reconciliation.start requires the matching explicit grant and accepts
organizationId, repository, itemId, rounds and intervalMs. The absolute bounds
are 1–100 rounds and 1,000–86,400,000 ms; the configured caps can only narrow them.
workflow.reconciliation.status requires its separate explicit grant and accepts
only the scope fields. Scope must exactly match the runtime's one configured item.
Extra queue/namespace/identity/hat fields are rejected, not interpreted as authority.

The same current principal subject/type, organization and exact grant are
rechecked immediately before either operation. Agents cannot carry human hats.
Status checks authority again after I/O. The invocation's original expiry also
bounds its lifetime; clock regression is denied. A scheduling grant is distinct
from the worker's fresh projection.ingest service authority on every round.
Caller credentials, hats and identity are not added to workflow history.

HTTP uses POST /v1/tools/{name}. MCP uses tools/call with the identical arguments;
structuredContent.result wraps the same result. The start command is advertised
as non-read-only and non-idempotent; status is read-only. Tools still require
authorization even though their contracts are discoverable.

## Receipts and uncertainty

Start returns {workflowId, outcome: 'started', runId}, or {workflowId, outcome:
'duplicate' | 'unknown'}. Started means the server returned an accepted execution,
not that work succeeded. A duplicate can be active or retained closed; inspect it
separately. A thrown error or malformed response can follow acceptance, so unknown
must not be treated as rollback or blindly retried. There is intentionally no
post-dispatch denial that would conceal an already accepted mutation. Each later
status call and worker activity still requires fresh authority.

Status returns found with workflowId, runId and the Temporal execution state,
not-found for the SDK's typed missing-execution error, or unknown. Provider error
text and invalid/mismatched output are not returned. Unknown status leaves the
outcome unresolved. Not-found is only the server's current observation: history
retention expiry or deletion can remove a past run. It is not proof that a start
never happened, nor permission for permanent-ID reuse or automatic resubmission.
No tool-level retry is added; activities remain maximumAttempts=1.

## Verification and next work

Native tests cover both authorization windows, fixed bounds, configuration
mutation, typed errors and uncertain results. Official MCP/HTTP clients exercise
schema/result parity with a synthetic scheduler. The Temporal integration uses
the real local server through the canonical registry and actual client adapter,
with a synthetic activity port; existing actual Git/Postgres/process recovery
checks remain separate regression groups. These are not an all-in-one live
OIDC-to-Temporal deployment test. See intent/0039/EVIDENCE.md.

Next: trusted runtime connection ownership, source-derived gate waits/cursors
and business tools. Multi-item scheduling, webhook/continuous scheduling,
active-activity/fleet/server recovery, production cluster security/retention,
full operating screens and formal gates remain open.
