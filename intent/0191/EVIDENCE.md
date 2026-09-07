# Evidence

Baseline: `d17a5eba2298efba1af3dbb0ac3fb69748343794`. Unrelated untracked
`docs/REAL-USER-ROADMAP.md` and `outputs/` are preserved untouched and unstaged.

## Verification — 2026-09-07

All 78 web unit tests (seven new controller cases), initial seven typechecks and
production Next build passed. The final browser run passes all 46 checks with
Keycloak 26.7.3 and Chromium 151.0.7922.34. It exercises the actual production Next
component with scoped native Git sources, encrypted PostgreSQL sessions and
current membership, including exact fingerprints, no automatic reads, denial
clearing, restored access, keyboard focus and page lifecycle clearing. Its original
45 checks remain intact, including the disposable save/Temporal/projection path.
Desktop/mobile supporting-document screenshots were inspected at original size;
mobile and 200% text layouts have no horizontal overflow, and the review workspace
has no automated WCAG 2.1 AA-tagged axe violations. This does not replace qualified
manual accessibility acceptance. Owned Chromium/HTTPS/Temporal services and
synthetic PostgreSQL/Keycloak containers, tmpfs data and generated test credentials
were cleaned by their harnesses. Screenshots remain in `/tmp/steer-0191-ui.0v6xYX`.

Kit (95 artifacts), workflow-scope audit, 88 prototype tests, 439 repository controls
and all initial workspace tasks passed (11/11; 2 cached). Registry 121, adapters
326, data 24, web 78, worker 40 and API 109 tests executed freshly; the unchanged
domain suite replayed 13 passing cases. The final post-browser run passed seven
typechecks (six cached), 11 workspace tasks (ten cached; API 109 reran freshly)
and seven builds (four cached; Next, API and worker rebuilt freshly). Kit validation
passed again. Together these cover every full-check component without overlapping
the final Next build and browser service.
Exact tuple/closed schema, unknown stage, no authority,
copied views, no automatic fetch, denial, clock expiry and cancelled/late reads are
covered by synthetic controller tests.

The first browser run stopped during fixture projection setup, before UI checks:
adding a sibling Spec to the initial fixture made its deliberately exact two-file
inventory assertion fail. The new scenario now creates its own fixed Brief/Spec
only after the original inventory and decision scenarios finish, and uses separate
explicit test curation. The original two-file assertion and initial projection
count remain unchanged. The failed run cleaned its owned test services/resources.
The second run reached the existing mobile Brief dialog assertion. That assertion
scrolled to the end of the dialog and assumed the source fingerprint would be
visible there; the additional supporting section moved it above that viewport.
The failure screenshot confirmed this positional assumption. The test now scrolls
to the exact fingerprint and retains the full viewport-containment assertion;
no layout/visibility requirement is removed. Its owned services were cleaned.

The existing local URL `http://127.0.0.1:3000/` returned HTTP 200. Opening the panel
returned queued, not proof that an authenticated supporting-document view appeared
for the user. Actual browser verification uses the owned disposable integration
profile, not the user's live membership or GitHub access.

Commands use Node 24.20.0 through `npm exec --yes --package=node@24.20.0 --`:
`pnpm --filter @steer/web test`, `pnpm --filter @steer/web typecheck`,
`pnpm --filter @steer/web build`, `pnpm --filter @steer/api typecheck`,
`pnpm --filter @steer/api test:auth:browser`, `pnpm kit:check`,
`pnpm security:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:controls`,
`pnpm test:workspace` and `pnpm build`. Full-check components run in phases;
final builds wait until browser shutdown. `git diff --check` passed.
Baseline remote equality was verified before committing; candidate push equality
and remaining worktree status are verified at handoff. No remote CI result is inferred.

## Limits

This mounts read-only inventory, not verified lifecycle inputs, a connected Flight
Board, actionable Inbox or a gate signature. Current server grants/curation remain
required. No live grant/provider, protected document, credential, spending,
deployment, release or real-data deletion changes. The package adds only a schema
export; the lockfile and installed dependency versions are unchanged.

The existing browser-test profile uses disposable identities and services. Actual
Keycloak/Git/PostgreSQL/Next execution does not make its synthetic approval claims
real governing authority. All five R5 findings and qualified independent protected
review/human gates remain open. Synthetic save/recovery regressions are not a
completed approved real-user journey or permission to activate live saving.
