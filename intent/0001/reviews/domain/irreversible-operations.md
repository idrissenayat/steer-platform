# Gate 2 domain review: irreversible operations

Status: **awaiting eligible human irreversible-operations specialist**

Bound target: `c61ae86e9ca63a249e75e629935cba2fcc504fd6`  
Exam: `intent/0001/EXAM.md`  
Exam SHA-256: `6b56cbe41c6bb220780655e8253aa5e0539e47b9f18ff033ead10e2b0a02b16b`

## Required review scope

- Authoritative commits, signatures, release records, evidence retention, and
  forward-only migrations.
- OR-02, OR-05, OR-06, OR-14, OR-20, WS-02, WS-04, WS-05, WS-09, WS-12,
  WS-13, SIG-05/06/08/10/12/14, and applicable cross-tenant mutation rows.
- Stale action, conflict, retry, timeout, replay, rollback, recovery, deletion,
  expiry, and partial-failure behavior.
- Named human boundaries for release, regulated operation, paid deployment, and
  spending; no ceiling or test result may substitute for authorization.

## Approval questions

1. Does every irreversible action have a verified actor, exact target, current
   authority, idempotency key, durable result, and refusal path before effect?
2. Do stale, repeated, conflicted, timed-out, and partially failed actions avoid
   duplicate or ambiguous authoritative outcomes?
3. Are append-only records and retained evidence distinguished clearly from
   disposable projections and safely rebuildable state?
4. Are destructive migration and deletion cases forward-recoverable, scoped to
   the exact tenant/object, and unable to erase audit or signature truth?
5. Are production, release, regulated-use, deployment, and spending boundaries
   separately named and default-closed?

The reviewer must record `approved`, `send-back`, or `declined` through the
human review procedure in [`README.md`](README.md). No disposition in this
packet authorizes an irreversible production action.
