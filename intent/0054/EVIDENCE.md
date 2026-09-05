# Development evidence

Baseline 2f3d5df97fdedc610e4a58b3aeeb3d0a7bc1b4b0 plus this increment.
2026-09-05 UTC; development evidence, not gate approval.

Three native location groups test exact Unicode/max-bound round trips, field
limits, controls, scope/path/revision shape, extra/missing/duplicate fields,
malformed/alternate encoding and unrelated fragments. All 19 native web groups
pass, including existing exact-reader membership and close/late-response checks.

Actual browser verification initially passed all three new navigation groups,
then failed in the existing reference-panel audit. The new full document reload
removes the earlier test-injected axe global. The harness now explicitly loads
its audit engine before that audit; no production behavior or limit was relaxed.
The rerun pnpm test:auth:browser exits 0: all 37 counted groups plus inventory
pass on Keycloak 26.7.3 / Chromium 151.0.7922.34. Fixtures use actual synthetic Git,
PostgreSQL and TLS; no real user/provider credential is used.

New evidence covers exact metadata fields in the fragment, Back/Forward/reload,
one discovery/read per restored navigation despite paired events, focus return
and clearing the current fragment on close. Foreign organization/repository,
stale revision/digest and malformed duplicate fields issue zero detail reads;
a saved link fails after committed grant revocation. Existing dialog/Markdown,
keyboard, responsive/axe, expiry, identity, transport and shutdown checks pass.
Functional ingress remains paced as documented in 0049, not capacity evidence.

Frozen install and git diff --check pass; no dependency/lockfile change. The final
pnpm check exits 0: all kit/security checks, typechecks, 88 prototype tests,
23 controls/boundaries, package suites (web 19, API 68, registry 48, domain 7,
data 20, adapters 61, workers 18) and builds pass. Node 24.20.0 / pnpm
11.19.0. Standalone PostgreSQL evidence remains 0053 (34 groups), Temporal remains
0045 (18 groups). No new screenshot pass is claimed for this navigation-only
increment; the inspected layout baseline is 0053.

Harnesses cleaned only their run-owned synthetic containers, tmpfs data and test
credentials. Source remains memory-only; reference metadata deliberately appears
in URL/history and is documented separately. No automatic external sharing,
clipboard write, source-content storage, model/provider access, live grants,
protected Exam, signature, spending, production mutation, merge or deployment.
Publication and exact remote equality are verified in the task handoff. Full
intent/0003, post-provider-login return-to-link, qualified manual review and
formal gates remain open.
