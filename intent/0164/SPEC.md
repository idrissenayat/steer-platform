# Spec

Add the read-only `intent.brief.decision.evidence` tool to the shared typed registry.
Input binds the existing exact Brief tuple, the selected decision path/revision/
SHA-256 and one referenced artifact path/revision. Require the new tool grant plus
all decision-read, Brief-read and raw-content grants. Re-read the exact Brief and
current curated decision sources using the existing decision query. The selected
decision must still match its entire reference tuple and list the requested exact
artifact path and revision. The artifact must independently be in the configured
raw-content path set; source references cannot grant access.

Read only that exact projected artifact revision, recompute SHA-256 and Git blob
identity, preserve original text up to the existing 512 KiB limit, and revalidate
the current identity/all grants after I/O even when absent. No HEAD fallback,
external URL following, arbitrary repository browsing or write capability. Return
literal false gateVerified/writeAuthorized markers and exact decision/Brief context.
Stale selection returns unavailable/null, not replacement content or an approval.

In the existing decision section, keep the selected Brief's internal link and add
manual source-inspection controls for other recorded artifact references. Show one
source at a time with exact metadata, inert original text, unverified-evidence
labels, loading/failure/unavailable states, and close/focus return. Clear source on
new selection, failed read, parent refresh/close/hide/expiry. No browser storage,
background polling, HTML/script execution or automatic requests from record text.

Use isolated Git/PostgreSQL/Keycloak/browser tests. Real permissions/configuration,
signatures, credentials, repository records, provider access and spending stay held.
