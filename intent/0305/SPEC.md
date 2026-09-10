# Owned records read-set contract

1. Internal production source imports no test reader or test decoder. Trusted
   construction pins both scoped database pools and every policy method.
   The bounded target describes already-retained review/development/save history;
   this reader does not invent operation/review IDs for initial capture.
2. A present read-set authority grants metadata enumeration for the exact
   configuration/target and returns a revision covering all records grants.
   Every group has a separately required record policy. No permissive default.
3. Query metadata without returning `encrypted_value`. Check role/login/RLS,
   tenant/subject/product, exact targets, unique identities, required membership,
   row/byte bounds and draft/candidate lifecycle. Independently grant every row
   before fetching any ciphertext. The complete content snapshot must have
   exactly the authorized metadata. Nothing is decrypted by this component.
4. Keep existing server query/lock/transaction limits and lifecycle row locks.
   Reuse existing draft and execution/usage roles; create no schema or connection.
   All SQL inputs are parameters. Sanitize failures and clear/evict owned leases.
   Operations/steps use their native organization/subject and exact draft/operation
   linkage, with product authorization in the independent policy context. Do not
   invent product columns. Candidate-save steps require null model budget; model
   steps require the exact target budget. Reads never grant model usage.
5. A trusted read-only verifier receives the frozen encrypted snapshot and a
   one-use `recheck` function. It must await recheck after decoding/key/source
   work and before final corpus closure. Recheck reruns all record policies and
   retrieves and compares every complete row and lifecycle. Missing, failed,
   repeated or unawaited recheck cannot release a result. Independent key and
   plaintext/SDK/source verification remain the verifier's responsibilities.
6. No authority cache or evidence survives a call. Fresh authority surrounds SQL
   phases and final return; a changed grant revision denies. Initial lifetime can
   shorten, never extend. Invalid/backward database or monotonic clocks deny.
7. Bound admission to four actual operations and each call to 30 seconds.
   Cancellation/close rejects promptly but retains admission until pending
   connect/SQL/policy/verifier/recheck work drains; shutdown waits for that work.
8. Native acceptance uses disposable local SQL and synthetic providers only.
   Preserve late record/key/source loss, hold, new revision and exact crypto/SDK
   checks. Count every simulated provider attempt; do not relabel the reader as
   installed in the application or the partial measurement as full C22.
