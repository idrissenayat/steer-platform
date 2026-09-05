# Execution route

1. Extract the shared session contracts without reversing package dependencies.
2. Implement versioned authenticated encryption and explicit keyring handling.
3. Add Drizzle tables and separate role/FORCE RLS migration.
4. Implement bounded insert, atomic consume, read/expiry and local deletion.
5. Exercise real disposable PostgreSQL with isolated roles and child processes.
6. Run Node 24 root checks, record evidence, commit and push the candidate.

Next increment: API route composition and browser-code integration. Do not
enable routes just because the storage package passes development checks.
