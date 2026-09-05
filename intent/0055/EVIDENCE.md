# Development evidence

Baseline 07a322bbab8ba13979bd95a33a12bc10d66f5130 plus this increment.
2026-09-05 UTC; development evidence, not gate approval.

The first actual browser run passed all 37 counted authentication/browser groups
plus inventory. The synthetic source deliberately puts Open questions first;
the rendered DOM follows the review sequence, preserving unknown context and
escaped script text. Existing saved-link/current-grant revocation, exact-source,
keyboard, responsive/axe, expiry and shutdown checks also pass.

Screenshots in /tmp/steer-0055-ui.NDUjc0 were inspected at desktop 1440x1000 and
mobile 390x844, including the scrolled source fingerprint. The initial captures
were scrolled by the source-disclosure test, so the harness now explicitly resets
the body to the top before taking the reading-view images. The final rerun passes
all 37 groups on Keycloak 26.7.3 / Chromium 151.0.7922.34, and the refreshed top-of-
document desktop/mobile images were inspected. No qualified manual audit is claimed.

The final pnpm check exits 0: kit/security checks, all typechecks, 88 prototype
tests, 23 control/boundary tests, and package suites (web 24, API 68, registry 48,
domain 7, data 20, adapters 61, workers 18) and builds pass. Frozen install and
git diff --check pass with no dependency/lockfile changes. Node 24.20.0 / pnpm
11.19.0. Standalone PostgreSQL evidence remains 0053 (34 groups); Temporal remains
0045 (18 groups). Functional browser ingress is paced as documented in 0049,
not capacity evidence. Publication and exact remote equality are verified in
the task handoff.

Native tests use the actual CommonMark renderer, not a Markdown string mock.
They compare original rendered output exactly for conservative fallback and
assert node identity, section/body pairing and retention for reordered documents.
Tests cover Unicode/CRLF, fences, nested headings/definitions, rich/duplicate
headings, unknown sections, escaped HTML, cyclic/malformed and oversized trees.

No dependency, live provider access, source write, protected Exam, signature,
spending, deletion of real data, merge, release or deployment change. Harness
cleanup is limited to run-owned synthetic containers and credentials. Five R5
findings and the remaining intent-detail/business-service work remain open.
