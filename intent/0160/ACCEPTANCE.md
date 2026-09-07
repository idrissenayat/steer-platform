# Development acceptance

- Strict explicit profile and password; foreign scope/unsafe transport rejected.
- Construction and denied identities perform no receipt/source/database access.
- Actual production sink reads/ingests through current projector identity and CAS.
- No parallel run, automatic retry, live dispatch or caller-owned resource closure.
- Shutdown drains actual work, closes the owned pool and keeps admission closed.
- Configuration/run failures are sanitized; post-write uncertainty is not rollback.
- Disposable browser and full repository checks pass; exact-record behavior remains.
- All five R5 findings and human gates remain open; no live save/deployment/spending.
