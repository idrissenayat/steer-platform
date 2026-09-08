# Specification

1. Add portable strict input/output contracts for `intent.scope.prepare`. Input
   contains only organization/product/repository, configuration revision, saved
   draft/revision digests and the previously reviewed source snapshot digest.
   Reject text, documents, evidence, model settings, grants, budgets, batch lists,
   review IDs and disposition choices supplied by the caller.
2. Expose preparation as a command through the shared typed registry, authenticated
   HTTP and generated tool descriptions/OpenAPI. Require an explicit current human
   grant plus exact service owner/scope. Revalidate before, during and after work;
   suppress responses after permission loss and sanitize private failures.
3. The explicit data service reads the latest exact encrypted draft revision. Build
   scope from original text, clarification and the saved edited Brief/Spec; never
   include the draft Exam. The server fixes execution configuration, original
   expiry and scope profile. Current records/source/key/preparation authority is
   mandatory, not inferred from schema validity or configuration.
4. Rebuild whole-target batching from independently fetched evidence. Match the
   exact scope and reviewed repository snapshot. Re-read draft and evidence around
   preparation authority, admission, capture and acknowledgement. A changed source
   or repository head is not silently adopted into the same request.
5. Admit through the existing immutable scope operation store, preserve the exact
   original through the existing encrypted records store, then read it back before
   acknowledging preparation. Exact replay recovers the same ID, manifest and
   ciphertext without renewing expiry. Distinguish conflict, unavailable and
   uncertain outcomes; a lost acknowledgement never grants execution or resend.
6. Return bounded coverage counts and preparation references, not private content.
   Partial but reviewable evidence may be prepared with explicit gaps and
   `plannedComplete: false`. Empty verified inventory returns `no-sources`; fully
   unavailable/unplannable evidence returns `scope-incomplete`. Neither schedules
   work or establishes uniqueness. All semantic/authority/save/gate flags stay
   false and model calls started stays zero.
7. Share at most four active preparations, with a thirty-second outer deadline.
   Retain admission until underlying dependencies drain; close owned stores and
   guard late continuations. Recheck execution expiry after the final awaited
   authority call before releasing readiness. No schema or migration is added.
8. Add an explicit API composition using the actual repository-wide corpus
   collector and code-host reader. Keep identity, product/lifecycle selection and
   per-source read authority mandatory. This factory is not installed by default
   and has no model transport, workflow starter or runtime Git writer.
9. Verify actual HTTP/SQL/encryption, concurrent/replayed admission, lost responses,
   source corrections, holds, revocation, expiry, and native-Git corpus preparation
   under synthetic grants. Do not claim live UI or semantic acceptance.
