# Gate 2 domain review: irreversible operations

Status: **awaiting independent fresh-context irreversible-operations-review agent**

Bound target: `118302e080598a147294e32d40cf5296763c8cc4`
Exam: `intent/0001/EXAM.md`  
Exam SHA-256: `e38d6a95145ddafef4b12fb1c795aaa76fdcf009da8cc141ed2430cd69ffcc53`

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

The agent must record `approved`, `send-back`, or `declined` through the domain
assurance procedure in [`README.md`](README.md), including confidence, findings,
and every human-escalation trigger. No disposition in this packet authorizes an
irreversible production action; that trigger always routes to a human.
