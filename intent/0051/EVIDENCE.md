# Development evidence

Baseline 1703313894685e334a111e0e04514c288d6bfd0f plus this increment,
2026-09-05 UTC. Development verification passes; no gate approval.

Five new registry groups pass (44 total): exact source/model, dual grants and
scope/path admission, null/absence/unavailability, content/digest/blob corruption,
and initial/post-read/post-parse revocation, identity switch and clock regression.
The official MCP native parity case now invokes intent.brief.read and compares
its result to HTTP while checking the generated discovery schema.

`pnpm check` passed on Node 24.20.0 / pnpm 11.19.0: kit/security validation,
all typechecks, 88 prototype tests, 23 control/boundary tests, native package
suites and builds. API 67, registry 44, domain 7 and web 11 tests pass.

The synthetic Git fixture now contains a Brief-shaped document. Browser/agent
fixtures explicitly grant the new tool only to synthetic identities. No live
grant or source content is rewritten.

`pnpm test:auth:browser`: exit 0, all 31 counted groups plus inventory pass on
actual Keycloak 26.7.3 / Chromium 151.0.7922.34 with synthetic Git/PostgreSQL.
Agent MCP reads and preserves the exact Brief; human browser HTTP checks the
document, wrong selected fingerprint, committed removal of each required grant,
and restored access. Existing nonce, responsive/keyboard/automated accessibility,
session revocation, lifecycle and shutdown checks pass. Functional requests use
the fixture pacing established in 0049; this is not production-capacity evidence.

`pnpm install --frozen-lockfile` and `git diff --check` pass, unchanged lock.
Candidate commit/remote equality is verified in the publication handoff.
Only run-owned synthetic containers/data/TLS credentials were cleaned by the
harness. No new UI/visual pass, standalone database/Temporal run, provider access,
spending, gate signature, protected Exam modification, merge or release claimed.
