# Development acceptance, not an independent Exam

| Requirement | Verification |
| --- | --- |
| Encrypted, exact-revision configuration | Digest-pinned AES-GCM envelope and no plaintext fixture file |
| Restricted file access | Canonical private root, final no-follow, regular-file mode/hardlink checks |
| Scoped key-manager seam | Exact unwrap purpose/scope/name/revision and opaque wrapped key |
| No unauthenticated plaintext | Tampered tag, invalid metadata/encoding/digest and wrong-key denial |
| Bounded work and input cleanup | Four in-flight reads, no cache/queue, transferred buffers wiped |
| Actual runtime usable afterward | Real HTTPS/Postgres login transaction decrypted with independent expected key |
| No hidden activation | Synthetic credentials only, default server unchanged, provider calls blocked |

No real KMS/Vault, external secret store, regulated deployment, ACL/distributed-
filesystem assurance, full memory erasure or gate approval is accepted here.

