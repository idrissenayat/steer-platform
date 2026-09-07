# Spec

- A closed recovery plan contains the original exact recorded target and failed
  original run ID. Deterministic recovery identity uses both. No content, credentials,
  actor record, receipt payload, queue or approval is serialized in that plan.
- Use a separate reference-linked workflow, not Temporal reset, original ID reuse,
  child-workflow ownership or a recursive recovery chain. Allow one retained recovery
  execution per exact failed original run; both conflict/reuse policies reject duplicates.
- A fixed read-only guard checks the current original workflow ID, exact failed run,
  original workflow type, source queue and namespace. Only FAILED is eligible; unknown,
  absent, running, successful, canceled, terminated, timed-out or replaced runs deny.
- Internal start snapshots routing before I/O, requires a dedicated recovery queue,
  verifies the parent and starts one bounded activity attempt. The worker independently
  rechecks the same exact parent before and after current projector authentication
  around receipt/source/SQL operations. A preflight observation is not durable authority.
- Reuse the original receipt subject/path/operation, source verification and SQL CAS
  semantics. A prior successful SQL commit followed by a lost acknowledgment must
  recover as duplicate, never a second ingestion event or another save.
- Keep current authorization, parent-binding drift, single-flight activity, bounded
  timeouts, no automatic activity retry and draining pool cleanup. Parent connection
  ownership stays with its explicit caller; the recovery runtime owns only its pool.

Observation and commit across Temporal/Git/PostgreSQL are not one atomic transaction.
Late changes may leave an applied/unknown result, not rollback; idempotent readback is
mandatory. A failed recovery is not recursively retried. Retention-bounded duplicate
protection is not an eternal operation registry. Public recovery authorization and
managed dispatch acknowledgment recovery remain unimplemented in this increment.
