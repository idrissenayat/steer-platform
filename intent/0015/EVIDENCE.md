# Development evidence

Verified on 2026-09-05 UTC using Node 24.20.0, from parent candidate
`3fbb91dfbe61f410ac779a0ea3054b67102880a8` plus this increment.

- `npm exec --yes --package=node@24.20.0 -- pnpm check`: exit 0. Kit validation,
  workflow-scope audit, typechecks, 88 prototype tests, 20 control tests,
  workspace tests and builds passed. Data unit tests increased from seven to
  ten. Unchanged packages used Turbo's local cache; this is not a fresh visual
  browser review or a production build/deployment observation.
- `npm exec --yes --package=node@24.20.0 -- pnpm test:data:integration`: exit 0,
  18 check groups on PostgreSQL 16.14. Four migrations applied twice safely.
  Seven new groups verify role/namespace separation, ciphertext-only storage,
  distinct reader-process restarts, TTL/foreign-insert denial, two-process
  one-use consumption, concurrent capacity/expiry, corruption/transplant denial
  and retained-key rotation. Existing eleven data checks remain passing.
- The harness confirmed removal of only its own uniquely labeled synthetic
  PostgreSQL container and tmpfs database. No existing volume/database was used.
- `git diff --check`: clean before publication.

All credentials and session records in tests were generated synthetic values.
No real runtime encryption key, database credential, provider grant or human
membership was provisioned. GitHub runtime/Test Agent keys were not read or
changed. No production migration, browser route, spending, release, gate
signature or business-record deletion was performed.

Remaining: route integration, local real human authorization-code verification,
approved server secret/database configuration and authoritative membership.
Operational expiry purge, backups and key rotation need a separate approved
runbook. This is development acceptance, not an independent Exam or Gate 2.
