# Brief

A timer over a synthetic activity is not proof that actual projection work can
resume safely. Compose the existing fixed-source reader, current agent grants,
bounded PostgreSQL projector and reconciliation logic behind the worker activity.
Prove duplicate-safe readback, worker/runtime recreation, repair and revocation.

Avoid copying lifecycle/security logic between the API job and worker. Preserve
Git authority, CAS/idempotent data writes, explicit scopes and owned cleanup.
Remain isolated: generated identities and disposable local services only.
