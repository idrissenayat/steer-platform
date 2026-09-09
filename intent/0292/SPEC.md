# Intent 0292 specification

1. Add one private read-policy composition helper. Owners authenticate before
   entering work. For each permission-only query: guard, invoke/track the actual
   policy, require a void success, guard, freshly validate caller, require a void
   success, guard. Reject non-read actions before dispatch. No caller, policy
   decision, source result, head, grant or key is cached.
2. Use this only for current/historical scope/development records authorizers and
   the read-only metadata authorizers used by development start. These callbacks
   query permission metadata; they must not fetch content, obtain keys, perform
   SDK verification, publish content or perform effects. The helper is not a
   public export, configuration option or proof of a before/after IO bracket.
3. Preserve full checked() barriers around key access and SDK verification,
   including historical exchange verification previously routed through the
   generic authority wrapper. Preserve existing historical/current private
   bracket proofs, scope read windows, full source/readback verification and
   separate start authorization/scheduling barriers.
4. Track actual pending policy work even if the owner returns early. An early
   tracker success must still await the actual policy; an early failure must
   observe late policy rejection. Closure and timeout suppress late continuation.
   Owners retain four-call admission until pending work drains.
5. Test helper ordering, strict void/read-only outcomes, proof non-recognition,
   revocation/closure during callbacks, early tracker behavior and all five
   actual owners' initial authentication, revocation-before-SQL and timed-out
   admission. Run the authenticated joined regression, focused records SQL,
   broad regressions, all types and production build. Compare provider counts
   separately from variable local latency; do not claim warmed p95 acceptance.
6. Preserve 0289's unexplained recovery failure, signed source hashes and
   unrelated work. Update the existing guides, ledger and fixed progress tracker
   with measured results. Only verified owned source changes may be committed
   and pushed; this does not authorize runtime GitHub writes or activation.
