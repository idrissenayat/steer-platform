# Intent 0288 specification

1. Construct private immutable current-read callbacks that invoke the exact bound
   caller before and after successful policy work. Identity-only proof is neither
   authority nor a cached result. Preserve receivers, arguments, owner guards and
   actual pending-work ownership; intrinsic invocation cannot be redirected by a
   function's mutable `call`/`apply` properties.
2. Current-only original verification may forward this proof only while actually
   calling the original callback with the same owner guards and bounded work.
   Historical proof remains separate. Unrecognized/replaced/copied/differently
   scoped callbacks keep the full current-caller pair.
3. Install the construction in drafting start's read-only original authorization.
   Current scope windows omit only proven duplicate caller barriers. Full initial
   and final scope verification, exact equality, current source/records/keys/
   profile/expiry checks, closure and admission bounds remain. Each scheduler
   revalidation owns a separate read-only window; no window encloses scheduling.
4. Test proof spoofing/forwarding, receiver safety, nonvoid and failed outcomes,
   pending-work drainage, independent callers, current-only result rules, final
   denial, escaped/changed ports and effect separation. Run focused SQL start and
   the actual authenticated default save/reopen journey; retain per-action counts.
5. Run broad regressions, types/build, documentation links and protected hashes.
   No live configuration, credential, model spend, runtime GitHub grant/write,
   records adoption, deletion, signature, deployment or release. Do not award a
   percentage point without completing a full fixed acceptance checkpoint.
