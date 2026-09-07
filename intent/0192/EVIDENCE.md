# Evidence

Baseline: 644767a5e93992902174f9a7518042a6bc72fcbf.
Unrelated untracked docs/REAL-USER-ROADMAP.md and outputs/ remain untouched.

## Verification — 2026-09-07

All 85 web tests (six new Learn compiler/search checks and one actual-component
check), web type generation/typecheck and initial
Next production build passed. Tests read all eight actual canonical byte strings,
verify SHA-256, reject version drift before I/O, reject path/identity changes,
missing/malformed UTF-8/oversized sources and ambiguous anchors, and cover deterministic generation
and bounded local search across section/list/table content.
Source checks compare original byte buffers, preserving BOM, CRLF and Unicode;
invalid UTF-8 and non-round-trippable source strings fail instead of being replaced.

Actual-component checks also verify inert hostile source text, no fetch, close
focus, pagehide clearing and permanent expiry for deadline, backward and invalid
clocks. These do not turn UI clearing into secure erasure or gate authority.

Kit validation (95 artifacts), workflow-scope audit, seven fresh package typechecks,
88 prototype tests and 439 repository controls passed. The workspace rerun passed
11/11 tasks (nine cached), including fresh 326 adapter tests; web 85 also reran
fresh. The preceding workspace run executed registry 121, data 24, domain 13,
worker 40 and API 109 freshly, but one adapter native-Git/crypto case exceeded its
unchanged 15-second collection budget under overlapping load (19.8 seconds).
The same case passed in 6.8 seconds on the rerun. No deadline, assertion or gate
behavior was relaxed, and no unrelated adapter source/test was changed.

The first browser attempt used manifest short titles as exact selectors, while
the shared parser correctly renders the full canonical document headings. The
test now selects each of the eight ordered documents and compares its complete
raw source and fingerprint. The second attempt passed source/search/outline,
responsive sizing and axe checks, then failed an immediate lifecycle/focus
assertion. The test now waits for the required committed React UI state before
asserting the same focus and cleared-content outcomes. Repetition then exposed
an actual intermittent section-focus race: a queued animation frame could target
the prior document or overwrite a later section selection. Focus is now applied
in a React effect after the selected document commits, with pending focus cleared
on closure. The actual-component test covers outline focus and close focus.
A build caught an explicit undefined optional field in that fix; the field is now
omitted when absent, preserving strict TypeScript settings.

The final browser run passes all 47 checks with Chromium 151.0.7922.34 and
Keycloak 26.7.3, including all eight canonical sources, exact raw bytes and
fingerprints, search, outline focus, closing focus, hidden-page clearing and clean
reopening. Existing 46 browser scenarios remain intact, including the disposable
native-Git/Keycloak/PostgreSQL/Temporal save and projection journey. Automated
WCAG 2.1 AA-tagged axe checks report no violations in Learn. The reader has no
horizontal overflow at 390px or 200% text. Desktop and mobile article screenshots
were inspected at original size; this is not qualified manual accessibility
acceptance. Owned browser, HTTPS, Temporal and synthetic PostgreSQL/Keycloak
resources and test credentials were cleaned by the harness.

Final `pnpm check` passed end to end: kit 95, workflow-scope audit, seven package
typechecks (five cached), 88 prototype tests, 439 repository controls, 11 workspace
tasks (nine cached; current web 85 and API 109 fresh), prototype build and seven
package builds (four cached; Next/API/worker fresh). The final Next build ran only
after browser services stopped. No remote CI result is inferred from local checks.

Build preparation was moved from Next configuration into the web package's dev,
build and typecheck scripts: runtime start must not try to reread the kit. Source
and script tests verify this separation. No dependency or lockfile update is needed.
The first final-check attempt caught the repository's existing route-generation-
first invariant. The typecheck script now retains Next typegen first, then prepares
the canonical data before tsc. The validator and its requirement are unchanged.
Final screenshots are /tmp/steer-0192-ui.RnJs9f/learn-desktop.png and
/tmp/steer-0192-ui.RnJs9f/learn-mobile.png. The same owned directory retains earlier
failure and regression screenshots; those are not final successful evidence.
The existing localhost:3000 preview returned HTTP 200; opening it returned queued,
not proof that the user's authenticated workspace is configured or visible.

Commands use Node 24.20.0 through `npm exec --yes --package=node@24.20.0 --`:
`pnpm --filter @steer/web test`, `pnpm --filter @steer/web typecheck`,
`pnpm --filter @steer/web build`, `pnpm --filter @steer/api test:auth:browser`,
`pnpm test:controls`, `pnpm test:workspace` and final `pnpm check`.
`git diff --check` passed. Baseline remote equality was verified; candidate push
and exact remote equality are verified at handoff. Only owned files are staged.

## Limits

This is a checkout-backed canonical reading surface. It does not authenticate a
released Git tag, close full intent/0004, implement role orientation ending in real
actions, glossary peeks, correction submission, analytics or qualified accessibility.
No live provider/access, protected canon/EXAM, signature, credential, dependency
version, spending, deployment, release or real-data deletion changes.
Gate 2, all five R5 findings and the approved real-user journey remain open.
