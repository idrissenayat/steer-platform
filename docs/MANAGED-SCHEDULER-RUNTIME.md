# Managed scheduler runtime

Increment 0040 composes 0039's optional tools into the actual identity runtime.
Git remains the system of record and Temporal remains derived execution state.
Shutting down an API connection does not cancel a workflow or undo a start.

## Configuration and ownership

The identity profile may include scheduling: {itemId, maxRounds, minIntervalMs}.
These fields use the existing bounded contract; extra namespace/queue/credential
fields deny. An explicit createScheduler factory must accompany this opt-in.
Without both, startup denies; without either, default behavior is unchanged.
The same dependency is forwarded by local HTTPS and secret-provider bootstraps.

The factory opens its already approved/configured connection and calls
createManagedReconciliationScheduler(client, configuration, closeConnection)
from apps/worker/src/client.ts. The configuration still fixes namespace, queue,
scope and caps. The caller must supply a closer bound to that exact owned
connection; never supply a shared connection it does not own. SDK imports remain
at the worker edge, not in the API or provider-free registry.

The managed wrapper closes its connection if adapter construction fails. A factory
that throws before returning a wrapper must clean its partial allocations itself.
Once the factory returns, createIdentityRuntime owns shutdown. It validates the
scheduler's organization/repository against the profile's Git binding and its
item/caps against scheduling. Mismatch or downstream initialization failure closes
the returned scheduler and allocated pools. No listener exists yet on that path.

The factory is a trusted programmatic seam, not an HTTP field, default environment
loader or approved live cluster binding. Cluster identity, TLS, queue/namespace
ACLs and deployment-specific credentials remain separate requirements.

## Request and connection lifecycle

The wrapper admits at most eight actual start/inspect operations. Shutdown changes
state from running to draining immediately and denies new calls. Existing calls
retain their connection until they actually settle; no timeout is described as
cancellation or rollback. Only then does the closer run once. Repeated shutdown
shares the same completion. Successful closure yields stopped; failed closure
yields failed with a generic error and never silently retries or reopens.

The identity service closes request admission and waits for admitted HTTP/browser
and MCP work, including final authorization checks, before owned resources close.
This also applies to browser-only composition when a scheduler is present. The
earlier browser-only profile without scheduling keeps its existing stop behavior.
Runtime cleanup attempts all owned resources and reports failure if any close
cannot be confirmed. Operational running/stopped is not business readiness.

Uncooperative RPCs retain their active slot and delay shutdown. Operators must
configure connection/RPC/ingress budgets in the approved live connection factory;
this wrapper does not invent a deadline that falsely declares completion. Closing
the client does not stop workers or the Temporal server; accepted workflows remain.
Do not bypass canonical tool authorization by exposing the raw managed port.

## Evidence and next work

Native tests exercise bounds, in-flight drain, initialization/closure failure,
single-close behavior and profile/factory mismatches. The isolated Temporal suite
opens a separate real client connection, transfers ownership to the actual API
runtime, reads the retained workflow and verifies closure while the test server
and its independent client remain usable. Its database pools remain lazy; this
is not a complete real OIDC-to-Temporal workflow acceptance test.

See intent/0040/EVIDENCE.md for final regression results. Next: source-derived
gate waits/cursors and business tools. Full operating surfaces, active-activity/
fleet/server recovery, live cluster security, deployment and formal gates remain.
