# Specification

1. An SDK-independent service accepts a lazy worker factory, owned projection
   runtime and connection closer. Start only once; repeated calls share actual
   completion. Startup status is operational, not business/health readiness.
2. Shutdown before startup never creates a worker. Shutdown during construction
   must await the constructed worker's actual run/drain before releasing resources;
   the installed SDK only permits stopping a running worker.
3. Normal stop requests worker shutdown, waits for execution, then runtime drain,
   then connection closure. Failure still attempts downstream cleanup, is generic,
   stays failed/closed and is not silently retried. Do not fake a completed stop
   while actual work remains pending.
4. The isolated child receives generated configuration via IPC, with no inherited
   credential environment or secrets in argv. It opens its own Temporal connection,
   PostgreSQL pool and read-only synthetic Git reader/current grant resolver.
5. Parent verifies distinct process IDs and SIGKILL termination during a recorded
   timer. A fresh child resumes the same execution, with exact artifact bytes and
   unchanged immutable ingestion count. A later SIGTERM verifies ordered closure.
6. Revoke the Git grant while the predecessor is dead; the fresh process must deny
   the next activity without further SQL ingestion. Never restore stale authority
   from workflow history or a previous process.

Non-goals: death during SQL/COMMIT or unacknowledged activity completion, fleet
leases, Temporal/PostgreSQL server crash, persistent cluster restore, actual OIDC/
GitHub credentials, automatic retries, governed gates, deployment or spending.
