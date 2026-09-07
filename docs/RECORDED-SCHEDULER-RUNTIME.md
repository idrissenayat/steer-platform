# Recorded-Brief scheduler runtime ownership

Increment 0176 composes the owned client and shared authorization tools into
`createIdentityRuntime`. Optional `recordedScheduling: { itemId, idempotencyKey }`
uses existing bounded item/UUID-v4 contracts. A separate `createRecordedScheduler`
factory must accompany it. Incomplete pairs or extra routing fields reject startup;
default CLI and existing profiles remain unchanged.

## Fixed configuration and ownership

The trusted factory supplies a managed client with a separately owned Temporal
connection. Namespace, queue, credentials and RPC budgets remain in that approved
factory, not HTTP or profile input. Never share its transferred connection with
the ordinary scheduler, worker or another owner. A rejecting factory must clean
partial allocations; ownership transfers when it returns the managed object.

The runtime matches organization/repository against its Git binding and item/operation
against the profile, including the derived workflow ID and lifecycle/tool methods.
Mismatch or downstream initialization failure closes returned resources and lazy
pools before any listener starts. SDK imports stay at the worker edge.

The service uses existing OIDC/current-Git authorization and separate dispatch/status
grants. The factory does not grant permission or authenticate callers. Initialization
does not dispatch, inspect, read a receipt or allocate a projector pool. A factory
may open its explicitly configured connection; this is not credential discovery.

## Shutdown and evidence

The identity service stops admission and drains HTTP/MCP requests and their final
authorization before closing owned scheduler/session resources. Recorded scheduling
participates even with MCP disabled. Repeated shutdown shares completion; failures
are sanitized, never reopen the service and do not prevent other cleanup attempts.
Underlying one-attempt/single-flight/draining rules remain. Closing a client does
not cancel an accepted workflow or stop the worker/server.

Tests cover exact configuration, current native Git revocation with actual signed
OIDC/App JWT verification, admitted request drain and cleanup failure. The isolated
integration connects authenticated HTTP through the actual identity runtime to an
owned Temporal client and real local worker. Provider/JWKS responses and its activity
result are synthetic. It is not a live Keycloak, complete Git/SQL save journey or
independent gate review. See `intent/0176/EVIDENCE.md`.

Increment 0177 separately joins this runtime to actual saved-operation readback and
Git/PostgreSQL projection in one disposable scenario; see
[the joined journey](AUTHENTICATED-RECORDED-JOURNEY.md). Its human/gate/projector
authority and provider responses remain synthetic; the 0176 scenario is retained.

No live profile/factory/grant is installed. Governed receipt/source-path admission,
complete save authority and approved dispatcher/cluster bindings remain open, as do
all five R5 findings and independent/qualified review/human signatures. No live save,
spending, deployment, release or real-record deletion is authorized.
