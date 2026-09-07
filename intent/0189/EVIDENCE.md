# Evidence

Baseline: `a89e895fcd57855efdb7ecd0df4599fcae71d655`. Existing untracked
`docs/REAL-USER-ROADMAP.md` was preserved without modification or staging.

## Verification — 2026-09-07

Web unit suite passed 71 tests, including six new controller tests. Web typecheck and
production Next build passed. The final enhanced browser integration passed all
45 checks with Keycloak 26.7.3 and Chromium 151.0.7922.34. All full-check components
passed: kit validation (95 artifacts), workflow-scope audit, seven typechecks,
88 prototype tests, 438 repository controls and all workspace tests. Workspace
tests completed 11/11 tasks (9 cached); web 71 and API 108 executed freshly.
Unchanged adapter 326, worker 40, registry 110, data 24 and domain 13 used eligible
cache. Final builds completed 7/7 (5 cached); Next.js rebuilt after browser shutdown.
The separate final controller run also passed all six tests after adding permanent
expiry and unsafe-origin assertions. `git diff --check` passed.
The first browser run timed out entering the direct review workspace. The existing
reopen/close test could press Escape before its asynchronous Brief had opened, allowing
a later modal to take focus. That test now requires the reopened dialog to be visible
before checking cleared records, and hidden before starting direct review selection.
The keyboard path also asserts actual enabled/focused state; no read/access assertion
is removed. Its failure screenshot also exposed missing card spacing and an inline
revision label; both presentation issues were corrected with existing theme tokens.
A second run, already executing before the visible-dialog wait was added, failed
the explicit focus assertion and showed the late-opened Brief dialog. The final
successful run executed the complete corrected open/close ordering.
The production entry point shares the existing current-authorized reader contracts;
controller tests use synthetic responses and exercise exact selection, no fan-out,
foreign/stale/denied reads, expiry, invalid/backward clocks, cancellation and late results.
The final browser run additionally verified direct keyboard selection and focus,
exact decision/evidence bytes, grant-denial clearing, restoration and explicit clear.
Desktop/mobile screenshots were inspected; mobile and 200% text layouts had no
horizontal overflow, and the new surface passed automated WCAG 2.1 AA-tagged axe
checks. This does not replace qualified manual accessibility acceptance.
Owned Chromium/HTTPS/Temporal services and synthetic PostgreSQL/Keycloak containers,
tmpfs data and generated test credentials were cleaned by the harness.

The existing local URL `http://127.0.0.1:3000/` returned HTTP 200 before QA. Opening
it in the desktop panel returned queued; this is not evidence of a visible authenticated
review workspace. Actual feature validation uses the separately owned disposable
browser/session harness, not a real account or live repository configuration.

Commands use Node 24.20.0 via `npm exec --yes --package=node@24.20.0 --`:
`pnpm --filter @steer/web test`, `pnpm --filter @steer/web typecheck`,
`pnpm --filter @steer/web build`, `pnpm --filter @steer/api test:auth:browser`
and the full `pnpm check` components: `pnpm kit:check`, `pnpm security:check`,
`pnpm typecheck`, `pnpm test`, `pnpm test:controls`, `pnpm test:workspace` and
`pnpm build`. These run in separate phases so the final build waits for browser QA.
Browser screenshots are written to the owned temporary path
`/tmp/steer-0189-ui.rTXTgP`. Browser QA and final Next builds do not overlap.

Remote equality to the baseline was verified before commit. Candidate push equality
and remaining-worktree status are verified at handoff; the unrelated roadmap stays
untracked and untouched. No remote CI, formal review or release result is inferred.

## Limits

Source records and revision linkage are not verified gate signatures, pending work,
assignments, urgency, lifecycle state or permission to act. The actionable Inbox and
Flight Board remain incomplete. Current server authorization and curation apply to
every read; no new grant, tool, model/provider access or browser storage is added.

No live identity/trust installation, GitHub writes, protected artifact, dependency,
database schema, spending, deployment, release or real-data deletion changed. All
five R5 findings, approved real configuration, full action-time authority, qualified
independent protected review and human gates remain open. Disposable Keycloak/Git/
PostgreSQL/Temporal fixtures are test evidence, not a completed approved real journey.
