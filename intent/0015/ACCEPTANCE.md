# Development acceptance, not an independent Exam

| Requirement | Verification |
| --- | --- |
| Encryption, random IV, authentication, strict envelope, key rotation | `packages/data/test/session-crypto.test.ts` |
| Forced RLS, dedicated role separation, TTL and foreign namespace denial | `packages/data/test/session-storage.integration.ts` |
| Persistence across store instances, connection reuse, scoped logout | same integration harness |
| Exactly one consumer across separate Node processes | `consume-login.child.ts` invoked twice by harness |
| Concurrent bounded capacity and expired-row reclamation | same integration harness |
| Ciphertext transplant and corrupt one-use transaction denial | same integration harness |
| Existing domain, API, broker and package boundaries preserved | root `pnpm check` under Node 24.20.0 |

Only observed passing checks may be recorded in Evidence. Formal Exam/signature
documents are not authored or changed by this implementation increment.
