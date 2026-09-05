# 0009 · Tenant-isolated PostgreSQL foundation

Parent: delivery M2. Authorized development only. Brief, Spec, Plan,
development Acceptance and Evidence accompany this increment. Independent
protected Exam, formal gates and production migrations remain pending.

The first two data tables are organization-scoped rebuildable projections and
an append-only ingestion log. Neither can create an authoritative Git fact.
The integration harness uses a disposable local database with synthetic data.
