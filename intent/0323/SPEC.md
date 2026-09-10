# 0323 — Review caller ownership contract

1. Only private registration of the exact source-review or final-review method
   may establish ownership of its caller brackets. Pin scope and method. A bound
   wrapper, public marker, ordinary registration or HTTP input cannot enable it.
2. The registered producer must call its supplied caller before dependent work
   and after final IO, retaining actual work through settlement. The session may
   omit only its additional outer checks. This is not an authorization cache.
3. Count successful completed checks for the exact original callback within the
   current consumption; require at least two and no still-pending check for that
   callback. Counts enforce completeness, not the semantic before/after-IO
   contract, which remains the responsibility of the two inspected producers.
   Parent checks cannot satisfy an independent child's obligation.
4. Any failed/nonvoid caller poisons the whole session, including swallowed
   denials. Preserve changed-port/scope/owner checks, escaped/parallel/unawaited
   read rejection, final draft/source/scope readback and actual owner drainage.
5. Verify focused misuse/authorization cases, both authenticated synthetic native
   save/recovery/reopen directions, types and broad regression. Count every
   provider attempt, including identity/token refresh. Keep C22 pending unless
   the unchanged full benchmark actually passes; no live acceptance is inferred.
