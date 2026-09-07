# Authorized recorded-Brief dispatch tools

Increment 0175 adds `workflow.recorded-brief.start` and
`workflow.recorded-brief.status` to the shared registry. HTTP, internal calls and
MCP derive the same schemas, authorization and results. Start is a command with
non-read-only/non-idempotent hints; status is a query. Discovery is not permission.

## Explicit composition and authority

The optional `ToolServices.recordedBriefScheduler` port binds one exact
organization/repository/item/operation ID. The 0174 managed Temporal client supplies
this structural port without a provider import in the registry. No identity-runtime
profile, public registration mechanism, CLI default or live grant is added. An
authorized caller without the service or current revalidator receives unavailable.

Both tools accept only organizationId, repository, itemId and UUID-v4 idempotencyKey.
The configured target must match exactly, including a derived deterministic workflow
ID; queue, namespace, source bytes, human subject and receipt are not request inputs.
The source branch/path/receipt subject still belong to the trusted worker binding.

Start requires a current hat-free agent and the exact `workflow.recorded-brief.start`
grant. Status requires its separate explicit grant and permits a current human or
hat-free agent. Human hats alone grant neither operation. These grants are distinct
from saving, ingestion and ordinary reconciliation; none supplies the others.
This is a candidate development contract, not installation of a real permission.

The shared current-principal checks enforce same subject/type, tenant, original
expiry, current grant and non-regressing invocation clock. Recheck immediately before
dispatch/inspection, and again after status I/O before returning metadata. Recheck
the configured binding after asynchronous authorization and after inspection.

## Results and recovery

Start returns started/run ID, duplicate, unknown or already-attempted from the fixed
client. Invalid, foreign or failed acknowledgments return only unknown. No automatic
retry or new operation is created. An accepted start remains accepted if a grant is
revoked afterward; later status and actual worker activities require fresh authority.
The client owns the one-attempt latch; the registry does not claim durable idempotency
for an arbitrary supplied port. See `RECORDED-BRIEF-DISPATCH.md` for connection and
Temporal history-retention limits.

Status returns validated minimal workflow metadata, not-found or unknown. Revoked
output is discarded; a provider error is not interpreted as absence. COMPLETED is
not a save receipt, successful ingestion, current Git state or gate approval.

The command dispatches an already configured projection operation. It neither
verifies/adopts a caller-supplied receipt nor admits a new source path. Current
projector authority and authenticated receipt readback remain independent worker
requirements. Full governed save authority, live runtime composition and automatic
receipt/path admission remain unfinished. All five R5 findings and independent/
qualified review/human signatures remain open; no live save/scheduler, provider
grant, spending, deployment, release or real deletion is enabled.

## Verification

`intent/0175/EVIDENCE.md` records focused authorization tests, official MCP/HTTP
parity and actual disposable Temporal/Git/PostgreSQL dispatch. Dispatcher identity
callbacks in these tests remain synthetic, not live OIDC or independent gate proof.
