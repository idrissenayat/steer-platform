# Ordered projection-change feed

Increment 0044 adds a derived tenant/repository delivery feed in PostgreSQL.
Git remains the business system of record. This feed helps consumers reconnect;
it does not establish source currentness, human authority or approval policy.

## Storage and transaction ordering

Migration 0004 adds projection_streams (generation UUID and bigint head) and
projection_changes (one reference per position). Both force organization RLS.
The app role can only read. The projector can insert immutable references and
advance the stream; it cannot delete either table or rewrite change history.
These are internal database privileges, not public authorizations.

An invoker-rights AFTER INSERT/UPDATE trigger shares the projection transaction.
It increments one stream row, holding its lock through commit, then appends the
record key, source revision and content digest. A later position cannot commit
before the earlier one. Rollback also rolls back the position and change.
Unchanged updates emit no event; real repairs do. Content and credentials are
never copied into the feed. Moving an existing record to another scope/key fails.

This serializes writes per repository and adds transactional write cost; it is
not an unmeasured high-throughput claim. Runtime direct deletion remains denied.
No deletion/tombstone lifecycle, retention cleanup or operational reset is added.

## Reading and resuming

createProjectionChangeReader is an internal @steer/data/projection-changes export
with a fixed organization/repository scope, the steer_app database role, and an
explicit projection.changes.read grant. Its caller must perform current source-
backed authorization before/after I/O, as the shared tools do; this reader does
not authenticate supplied principals or mount an endpoint. Expiry/clock checks
also reject a stale read result.

Pages are bounded to 1–100 references. One SQL snapshot supplies the generation,
head and page. Decimal strings preserve the full signed-bigint range. Cursors
are scoped references, not bearer credentials; possession grants no access.
Foreign scope denies. A changed generation, future position or missing expected
event raises ProjectionCursorResetRequiredError, never an empty-success fallback.

Null cursors return snapshotRequired: true, including when no stream exists yet.
Existing projections are deliberately not backfilled by the migration. A future
consumer must capture a checkpoint, obtain its authorized snapshot and replay
subsequent changes; if no stream existed or generation changes, it must complete
an explicit resnapshot handshake. It must not display the partial event page as
a complete repository snapshot. That transport/handshake is not implemented here.

## Limits and next work

The trigger covers projection inserts and updates, not every Git commit or gate
attempt. It provides database commit order within a repository, not cross-repo
business causality. Administrative loss/restore/reset requires a documented new
generation and consumer reset; automatic reset and retention remain unimplemented.
No public SSE, workflow cursor binding, canonical approval event or browser UI
is enabled. The gate source/proof verifier and five R5 findings remain open.

Development evidence: intent/0044/EVIDENCE.md. Signed architecture/plan and all
provider, gate, deployment, release and spending boundaries are unchanged.
