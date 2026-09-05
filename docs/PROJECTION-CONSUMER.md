# Bounded projection-consumer lifecycle

Increment 0047 adds createProjectionConsumer through
@steer/tool-registry/projection-consumer. This portable helper consumes the
canonical reference snapshot/page schemas. It has no Node/browser/vendor SDK,
credential, timer, persistence or approval behavior. The supplied port is
responsible for authenticated tool calls and throwing on failed/denied responses.

## Lifecycle

sync first obtains a complete snapshot. References replace the prior map and
the matching cursor becomes the resume position. Without a stream cursor, the
phase is waiting-for-stream and a later sync obtains a new snapshot. The helper
never invents a generation or interprets a partial change page as an initial view.

With a cursor, sync reads up to the configured page budget (default/max 10 pages,
default/max 100 events per page). It validates the whole result, then applies the
page and cursor together. Later events for a record replace its reference. Exact
decimal arithmetic preserves positions beyond JavaScript safe integers. A budget
ending with hasMore returns catching-up; only a caught-up result returns ready.
Ready means a derived delivery position, never current Git or gate authority.

reset-required clears references/cursor; the next explicit sync resnapshots.
Malformed/foreign/skipped data, silent generation switches, capacity overflow or
port failures enter failed and clear state. The helper does not expose private
error details or retry a failed port. It keeps at most 1000 reference records,
matching the snapshot service limit. Old records absent from a replacement
snapshot are not carried forward.

view returns immutable defensive copies and suppresses references while loading.
Concurrent sync calls reject before another port call. close immediately stops
admission and clears state, then waits for actual pending work; it does not claim
to cancel underlying I/O. Late responses cannot reopen the controller. Ownership
is registered before invoking ports, including reentrant ports, and closure
before dispatch prevents the request entirely. Scope/session changes must close
the old instance and create a new one; a cursor is not authorization.

## Integration and limits

Ports call projection.snapshot.read and projection.changes.read through an
authenticated transport. They must throw on transport/tool errors rather than
pass an error envelope as successful data. The controller validates data too,
but cannot independently prove identity, source currentness or policy approval.
Host UI code must close/clear on logout, session expiry and scope replacement.
Increment 0049 supplies that browser transport and lifecycle host in a read-only
reference panel; see docs/BROWSER-REFERENCES.md. Full operating screens remain
separate. No hidden polling or durable browser cache is introduced.

Native lifecycle/race cases and actual MCP/Keycloak/Git/PostgreSQL evidence are
recorded in intent/0047/EVIDENCE.md. The five R5 findings, canonical gate source/
proof verification, full business models/screens and formal/operational evidence
remain open. No live provider, deployment or spending approval was inferred.
