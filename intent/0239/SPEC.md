# Specification

1. Add the `checkpoint` scope transition from dispatch-committed to succeeded.
   `resultDigest` is the digest of the complete immutable response observation,
   including its request link and result, not only the parsed output digest. Preserve
   existing binding, owner, fence, reservation and clock constraints. No body, new
   result table, refund, extra reservation or dispatch permission is introduced.
2. A strict metadata-only checkpoint reference binds the execution-configuration
   digest, preparation, records policy, product, complete step binding, owner,
   fencing token, reservation and response payload digest. A reference alone is not
   a verified result or authority. Reject extra private/approval fields.
3. Checkpoint mutation requires an explicitly supplied void-returning trusted
   verifier. Missing verifiers default closed; admission/inspection/claim remain
   compatible and metadata-only. Inspection of succeeded metadata is not readback.
   Preflight checks current run, input, owner, fence and state, then rolls back and
   releases its SQL lease before encrypted readback. The verifier may use the same
   max-one pool. Keep bounded three-second dependency waits, eight active requests
   and five-second exact readback proof freshness. Drain late work before reuse.
4. Compose that verifier with the existing encrypted observation reader and its
   mandatory pinned SDK codec. Require the exact response/reference, current
   records/source/key/lifecycle authority and no unresolved outcome. Reauthorize
   and re-read current SQL state in a second transaction before recording success.
   Release the SQL lease before post-commit authority. Close, expired evidence or
   changed owner/state/authority withholds an acknowledgement. No generic effect
   retry occurs; only a read-only preflight is repeated under its exact proof.
5. Succeeded observation reads remain current-authority/SDK verified and must match
   the stored response payload digest. Request reads are not result proof. Exact
   checkpoint replay re-verifies readback but does not rewrite completed metadata.
   Lost checkpoint COMMIT acknowledgement remains unknown; verified later replay
   can acknowledge the already-committed result, never send another model request.
6. Quarantined/known-failed batches retain their existing verified-evidence reader,
   return no completion reference and require explicit outcome resolution. Normal
   checkpoint calls cannot erase those states. Reads still deny execution, retry,
   gate, semantic-quality and authoritative-clearance flags. Review expiry does
   not renew authority or reopen the currently closed expired-observation path.
7. Migration 0027 retains the invoker ownership/transition guard and adds a narrow
   SECURITY DEFINER checkpoint trigger. Exact execution session role and scoped
   tenant/subject/product precede cross-schema reads. Schema-qualified lookups bind
   both immutable observation stages, original, source revision, configuration,
   owner, fence, reservation and current lifecycle to the checkpoint. No general
   draft-read grant is given to execution runtime. Fix search_path to pg_catalog,
   pg_temp and revoke public/runtime execution; the migration owner must be trusted.
   See [PostgreSQL function safety](https://www.postgresql.org/docs/16/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY).
8. The checkpoint trigger takes a lifecycle share lock with NOWAIT. A concurrent
   lifecycle writer prevents checkpointing rather than waiting in reverse lock
   order while holding the batch. It does not skip the locked record or claim
   success. See [PostgreSQL locking clauses](https://www.postgresql.org/docs/16/sql-select.html#SQL-FOR-UPDATE-SHARE).
   Existing immutable-ciphertext privileges and trusted migration ownership remain
   prerequisites; SQL metadata checks do not replace decryption/SDK verification.
9. This is development-only. No actual migration, D1 records activation, keys,
   approved model spend, provider access, runtime Git writes, gates or deployment.
   Success does not imply all batches completed, sound semantic findings, permission
   to create/update an intent or any I1–I6 human acceptance.
