# Intent

Allow the server-side sign-in broker to work across processes and restarts
without plaintext credentials in PostgreSQL or replayable login transactions.
Preserve the selected Postgres/Drizzle and normalized identity architecture.

This increment does not enable real users, routes, membership grants, provider
writes, deployment or spending. It exercises only generated synthetic records.
