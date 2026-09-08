# Specification

1. Add `intent.scope.read` to the shared registry and generated HTTP/OpenAPI
   discovery as an explicit-grant human query. The normal endpoint is
   `POST /v1/tools/intent.scope.read`; request scope is organization, product,
   repository, review ID and preparation digest. Reject extra fields. Do not
   introduce a specialized unauthenticated route or grant-by-hat fallback.
2. Require a configured reader and current identity revalidation. Match service
   owner and organization/product/repository before access; revalidate after every
   awaited service read and again before returning output. Deny agents, expired
   or changed identities, missing/revoked grants and foreign bindings. Preserve
   existing sanitized errors and no-store HTTP behavior.
3. Export portable strict input/output contracts. Cross-check source revision,
   status precedence, unique ordered batch IDs, succeeded/result-digest pairing
   and exact pending/result membership. Expired results have no batches or review;
   source corrections are superseded and unresolved outcomes require attention.
   Always deny semantic quality, clearance, execution, retry, Git save and gates.
4. Share the combined-result response schema with the source-backed validator.
   Preserve its canonical digest field order. Check source/gap and batch accounting,
   duplicate sources/targets, profile consistency, citation membership and UTF-8
   byte lengths, incomplete/abstained coverage and the combined payload digest.
   Limit the serialized combined response to 4,000,000 bytes. A valid digest is
   integrity/structure, not provider authorship, semantic truth or source authority.
5. Add an explicit lazy API composition factory. A trusted server supplies the
   exact current scope-review profile and current records/source/draft/key authority.
   Match the retained profile, preserve void authority acknowledgements and use
   the actual pinned recorded SDK codec for every request/response verification.
   No arbitrary verifier, gateway credential or model transport is accepted.
6. Reuse 0240's original/observation stores, current snapshot checks, bounded read
   admission, expiry and shutdown behavior. No model dispatch, reservation,
   checkpoint write, key creation, schema migration or new private storage occurs.
7. Test actual HTTP-to-encrypted-SQL-to-SDK reads across reconstruction, partial and
   complete batches, missing services/grants, foreign scope, profile/source denial,
   non-void authority, corrections, holds, revocation and expiry. Fixture identities
   and responses do not authorize the real application or prove semantic quality.
8. The factory remains uninstalled by default. Do not change local profile flags,
   grant manifests, D1 records policy or spending state. Actual editor presentation,
   scope admission/Temporal scheduling, real authority and I1–I6 acceptance remain
   open. Browser contracts must remain free of storage, provider and server imports.
