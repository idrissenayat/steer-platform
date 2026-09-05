# Development evidence

Baseline afcfb78011f6c9a466674c1c052230a80fd3f705 plus this increment,
2026-09-05 UTC. Development verification passes; no gate approval is claimed.

Four new registry groups cover complete ordered reference-only output, all three
grants and scope, malformed/uncurated/duplicate/oversized results, unavailable
capability and post-read revocation. Three data groups cover exact query keys/
scalar bounds, pre-acquisition authority and role denial, corrupt mappings and
post-read expiry. Registry 48 and data 20 native tests pass.

`pnpm test:data:integration`: exit 0; 34 actual PostgreSQL 16.14 groups pass.
The new check ingests four synthetic artifacts but exposes only two curated
Briefs; tests foreign scope and projector-role denial, corrupts only the owned
synthetic row, observes rejection, and repairs from its verified source fixture.
Run-owned PostgreSQL container/tmpfs data were cleaned by the harness.

The initial root check failed on duplicate generated Next.js declarations:
cache-life.d 2.ts, root-params.d 2.ts, routes.d 2.ts and validator 2.ts. All four
were untracked/ignored and SHA-256-identical to their current generated originals.
They were moved recoverably to /tmp/steer-0052-generated-duplicates.15CdhH, not
deleted; no source/configuration workaround was added. Their origin was not
established. The rerun `pnpm check` exited 0: kit/security checks, all typechecks,
88 prototype tests, 23 controls/boundaries, package suites and builds passed.
API 67, registry 48, data 20, domain 7 and web 11 tests pass.

`pnpm test:auth:browser`: exit 0; all 32 counted groups plus inventory pass on
actual Keycloak 26.7.3 / Chromium 151.0.7922.34. Agent MCP discovers the curated
Brief then reads its selected exact tuple. Human browser HTTP verifies catalog
shape/scope and committed grant removal/restoration. Existing reference panel,
Brief-read, session, revocation, nonce, accessibility and shutdown checks pass.
Functional browser ingress is paced as documented in 0049, not capacity proof.

`pnpm install --frozen-lockfile` and `git diff --check` pass; unchanged lock.
Commands use Node 24.20.0 / pnpm 11.19.0. No new UI or visual pass is claimed;
Temporal evidence remains 0045 (18 groups). Candidate commit/remote equality is
verified in the publication handoff. Run-owned auth containers/data/test credentials
were cleaned by the harness. No migration, provider credential, live profile/grant,
spending, protected Exam, gate signature, production data change, merge or release.
