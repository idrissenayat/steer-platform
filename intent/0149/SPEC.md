# Spec

Add a destination section below the existing draft preview, using the established
pink/orange theme, semantic heading, status region and native button/details controls.
The server-rendered initial state has no repository metadata and a disabled control
until the client checks the session-display expiry. Do not alter author answers or
preview requests. No new libraries, routes, credentials, authentication or storage.

The user explicitly chooses **Check destination**. The fixed HTTPS same-origin
read transport calls only `intent.brief.destination` with the bound organization.
Reuse bounded transport cancellation, timeout, no-cache and generic error handling.
Strictly validate the shared output, matching organization, exact revision, canonical
unique paths and false gate/write claims. Reject future observations, observations
15 seconds old or older, requests taking 15 seconds or more, expiry and clock rollback.
Client clock skew may deny an otherwise valid observation; it must not extend display.

Show repository ID, branch, observed revision, UTC timestamp and expandable configured
paths. Describe these as candidate paths that may exist, not grants, selected paths,
verified availability or a lease on the branch. Saving stays absent and explicitly
unavailable; do not pass observation fields into a write action.

A request owner clears prior details on refresh, suppresses late results after
replacement/invalidation/closure, and clears displayed data at the earlier of
observation plus 15 seconds and session-display expiry. Page hiding, page departure,
back-forward-cache restoration, expiry and component teardown invalidate pending
work. Returning to the page does not automatically refetch. An old timer must not
clear a newer observation. No browser storage or background polling. Browser
scheduling can delay the timer/repaint; this is a display expiry, not an authority
or confidentiality deadline. Every observation is explicitly historical even before
its display expires and cannot be submitted as permission by this component.

All non-success source/access responses show generic unavailable guidance and clear
old details; do not expose remote response bodies or infer absence of configuration
from one error. Bound page identity is only presentation; current server-side
authentication and grant checks remain mandatory on every request.
