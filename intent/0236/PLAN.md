# Plan

1. Reconstruct exact scope originals and manifests without inherited Exam context.
2. Add bounded authenticated multi-part envelopes and an immutable, owner-isolated
   original table tied to admitted review and durable source revision.
3. Implement capture/read under current records/source/key authority, explicit
   historical expiry and no execution renewal. Reuse existing draft readers.
4. Verify real SQL recovery, concurrency, missing acknowledgement, subsequent edits,
   holds, revocation, tampering, wrong roles and shutdown; run compatibility checks.
5. Document observed evidence and unchanged signed hashes, commit/push owned files,
   verify remote, then continue recorded observations/results and Temporal wiring.
