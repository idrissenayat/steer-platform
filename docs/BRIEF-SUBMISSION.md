# Browser Brief submission boundary

The authoring screen has an explicit submission implementation, but its server-owned
display switch `STEER_WEB_BRIEF_SUBMISSION` defaults closed. Only the exact value
`enabled` exposes the guarded controls. This does not configure an API writer,
grant repository access, supply gate evidence or permit spending/deployment. No live
environment has been enabled; the opt-in value is used only by an owned disposable
browser-test process. Real activation still requires the existing full-authority,
review, signature and provider boundaries. Do not enable it to bypass a held writer.

## What a click does

The user reviews the exact preview and a freshly observed destination/path. One
explicit submission binds a snapshot of the original facts, subject, expected Git
head, rendered-content digest and UUID-v4. The frontend recomputes preview/request
and Git-blob hashes. The backend independently validates the request and all current
authority before its single create-only CAS. A checkbox or display switch is never
write authorization or a gate signature.

The mutation transport is separate from the read-only tool transport. It admits only
the fixed HTTPS same-origin save endpoint, same-origin cookies, no redirects or
referrer, a 16 KiB request, 64 KiB response and ten-second logical deadline. Abort,
timeout or a missing/invalid response may follow an actual commit; none proves
rollback. No automatic retry or automatic status polling exists.

## Recovery and lifecycle

Only one submission attempt is admitted per mounted authoring session. Later edits
do not change that operation or unlock a second attempt. Manual status uses exactly
the original reference and rechecks current server access. A committed receipt must
match subject, target, operation ID, original expected head, request digest, content
SHA-256 and Git blob. Unknown/not-found/pending/conflict never permits resubmission.

Feedback lives outside the destination's 15-second display lifetime. Keep the shown
operation ID before leaving or hiding the page. There is no browser persistence.
Hiding, navigation, session expiry and unmount close pending requests and discard
late results and receipt details. After a dispatched operation is cleared, its
attempt latch remains closed. After refresh, use the existing previous-operation
lookup with that original ID; the system cannot recover an ID the user did not keep.
This is a deliberate current recovery limitation, not durable browser draft storage.

## Evidence boundary

`intent/0167` tests actual local browser/Keycloak sessions, current native Git
membership, the production request-owned writer, native Git creation and exact
PostgreSQL projection reads. The code-host network transport and full Gate 2
authority are explicit test doubles. Real saves, provider permissions and human
gates stay closed. The 0166 integration separately verifies the durable Temporal
worker; the browser fixture's owned projection job does not itself prove a live
save-to-scheduler installation. See the numbered evidence record for actual results.
