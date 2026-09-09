# Specification

1. A private forwarding helper accepts only a previously constructed read whose
   exact current-policy identity is in the private construction registry. It
   invokes that captured method with the original receiver and arguments and
   returns its actual result. Binding/wrapping/copying cannot create a proof.
2. Forwarding adds synchronous parent bookkeeping, not a permission lease or a
   cached grant. The source method still evaluates current authority and both
   source grants. Owner closure, revocation and errors suppress bytes.
3. The catalog uses forwarding only when the source read covers its exact
   authorizer. Replacing that proven method rejects the forwarded read. Unknown
   ports keep the original full policy path. Root/directory/body checks, source
   bounds, manifests, exact hashes, coverage gaps and final authority remain.
4. Candidate bundle callbacks optionally enter/leave a parent's admission count.
   This is synchronous bookkeeping only, with no authorization meaning. Release
   follows actual callback settlement, not the timeout race returned to callers.
   Calls without a parent retain their existing behavior.
5. Tests compare exact native catalog output and read counts, verify policy
   reduction, reject replaced/unproven methods and closed parents, and hold a
   final policy after cancellation to prove admission is retained until drain.
6. Rerun focused adapters, authenticated synthetic joined save/recovery/reopen,
   broad regressions, types and build. Retain per-action traffic measurements and
   label performance incompleteness; never raise the 200-request ceiling.

No public request can assert a read proof or grant. No authentication bypass,
source filtering, model activation or runtime provider write is introduced.
