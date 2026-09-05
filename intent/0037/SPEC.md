# Specification

1. Extract a shared projection-job adapter with exactly one bounded selector,
   fresh authorized agent before each run, a principal supplier for each storage
   action and final reauthorization before returning the receipt. Refuse human
   hats, wrong tenant, missing grant, expired identity or changed subject.
2. Share abort, overlap refusal, truthful drain and sanitized resource failure
   handling between the API composition and worker runtime. Retain the API's
   public one-shot profile and status contract.
3. The worker runtime binds scope to reader organization/repository, accepts
   explicit database configuration and separate password, always uses the
   bounded steer_projector pool and exposes fixed-scope activities only. No
   workflow argument can select a reader, SQL role, credential or storage target.
4. Database/adapter/Zod imports stay in worker runtime.ts. Workflow contracts
   remain unchanged and vendor-free; existing Temporal package pins stay fixed.
5. Actual isolated Git/Temporal/PostgreSQL verification must cover two-artifact
   exact-byte ingestion, resumed durable polling after worker/runtime recreation,
   no repeated events, history replay, source-based repair and committed revocation.
6. Runtime closure waits for actual work and confirms owned pool closure. A
   rejected or discarded receipt never proves SQL rollback; replay relies on
   existing revision/event keys and CAS semantics. Automatic retries stay disabled.

Not claimed: OS-process crash, lost network COMMIT acknowledgement in this
harness, Temporal server restart, multiworker leases, real OIDC/GitHub credentials,
task-queue ACLs, production release, gate waits or approval.
