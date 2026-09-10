# Record-content composition contract

1. Existing stores and the new decoder share their actual canonical metadata,
   AAD, digest and payload definitions. Exposing internal codec references must
   not change the existing store's read/write, policy or lifecycle behavior.
2. Inspect every encrypted row with the canonical schema before key lookup.
   Compare owner, configuration and actual SQL columns; reject mismatched
   revision/digest/source bindings, malformed envelopes and mixed chunk keys.
3. Recompute draft content/scope fingerprints, original input/metadata hashes,
   result roles/digests, observation payload/request/output bindings and exact
   candidate bundle/confirmation binding using production contracts. Preserve
   source bytes and require captured originals to match their retained revisions.
   Decoding alone never establishes SDK verification, source permission or a gate.
4. Each encrypted group has its own required key-policy callback and explicit
   provider object. Every row's key grant precedes lookup. Share bytes only for
   the same exact provider, draft and key ID inside the current read; identical
   key IDs from different providers never share authority or material.
5. Copy provider-owned 32-byte keys, reauthorize each purpose and reread/compare
   exact material before final records/lifecycle readback. Withhold all results on
   denied, changed, malformed or replaced key services. Wipe owned copies on every
   outcome; never mutate provider-owned buffers or return keys to the consumer.
6. The underlying owned reader retains admission while key or verifier work is
   pending. The trusted read-only consumer must await key/records recheck before
   final source/SDK closure. Close/cancel/expiry cannot release late plaintext.
7. Local native evidence must use the new production decoder/key owner and
   compare exact results with the existing test-only crypto/SDK oracle. Exercise
   early/late policy and key loss, record/source races and cleanup. Report extra
   oracle work separately from application performance. No factory/profile switch,
   real key provisioning, model usage, records adoption or runtime GitHub write.
