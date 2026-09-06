# Development evidence

Baseline 8099965f5f204f7454aaa9b652809ac906da7887 plus this increment.
Twenty-five focused groups pass: eight new parent composition groups, nine archive
groups and eight historical-event groups. Final repository checks pass all 428 root
controls (151.3 seconds), 88 prototype tests, 95 required kit artifacts, security
scope audit, typechecks and builds. Unchanged package tasks use Turbo cache and
are not freshly executed package checks. The final separate full integration run
passes three groups (128.5 seconds), matching the existing full snapshot.

The initial repository/focused/full runs also passed. Before publication, review
added explicit signed policy digests to both manifest and head, with signature-valid
wrong-policy controls. All final verification above was rerun after that hardening.
Commands use isolated Node 24.20.0: pnpm check; pnpm r5:coverage:test-full; and
node --test tests/r5-provenance-history.test.mjs tests/r5-archived-derived.test.mjs
tests/r5-historical-events.test.mjs.

Fresh quick and full execution match the unchanged intent/0117 snapshots exactly:
393 passed / 3,643 uncovered quick; 409 passed / 3,627 uncovered full, zero failures.
No mapped source, existing fixture, hook or report changes are required. This new
fact-only component has separate tests and receives no exact-ID catalog credit.

Positive controls include retirement before final child deletion, retirement after
all children, and an explicit complete-empty manifest. Item closure occurs later
and cannot move the candidate boundary. All exact child event/receipt bytes and
complete qualified history execute together. Wrong child events and retirement
metadata, orphan children and repeated/missing retirement pass the existing full
qualified-history verifier but fail the new composition. Signature-valid manifest/
head policy, scope, count, ordering, completeness, history/archive and chronology
faults deny. An empty manifest signed alongside existing deletion history fails.
Missing original/full/archived owner evidence and unproved hold history deny.

retirementAuthorityVerified stays false on every result, retentionEligible is
absent, and boundaryCandidateAt is explicitly not eligibility. The frozen signed
policy requires qualified records-owner retirement authority; the existing 0082
schema only admits hold decisions. PLAN.md records the separate proof/archive
prerequisite and the dependency-cycle constraint for later full lifecycle admission.
No corpus-retirement human signature is fabricated or requested by this local work.

git diff --check passes. Frozen intent/0001, .github and pnpm-lock.yaml remain
untouched. Candidate publication is verified separately against the remote after
commit/push. No actual authoritative inventory completeness, live registry/store,
retirement authority, current parent action permission, copy inventory, readiness,
current-v7 completion, actual deletion, independent/protected acceptance, gate
signature, release, deployment or spending is proved or authorized. All five formal
R5 findings and the unchanged lifecycle/migration/schema backlog remain open.
