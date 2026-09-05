# Development acceptance, not an independent Exam

| Requirement | Evidence |
| --- | --- |
| Scoped TLS exception, unrelated certificate rejection | Chromium navigation checks |
| Actual cross-site login callback and human context | Native forms, Keycloak UI and browser fetch |
| Opaque secure cookie and no JavaScript/web-storage token exposure | Browser cookie metadata and page evaluation |
| Browser-enforced Lax handling plus server CSRF denial | Cross-site native logout form and observed request flags |
| Reconstruction, revocation and callback replay | Actual browser responses with durable store |
| Native logout clears cookie and database session | Browser cookie absence, row count and API 401 |
| Existing integrations/dependencies remain valid | Other harness modes, frozen install, root checks |

Tests live in `apps/api/test/browser-auth-harness.ts`; only observed browser
checks belong in Evidence. A rendered test form is not production UI acceptance.
