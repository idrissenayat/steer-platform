# Specification

1. Canonical fragment fields, in fixed order: brief=v1, organization, repository,
   path, revision, digest. Use the existing strict shared read-input schema,
   reject controls and cap the encoded fragment at 4,096 characters. Unknown,
   duplicated, missing, alternate/ambiguous encoding and malformed values reject.
   Unrelated fragments are not interpreted as Brief navigation or authority.
2. Successful card selection writes only the reference fragment with native
   history.pushState. No source body, identity, token, grant, title or signature
   is copied into application history state. The installed Next.js navigation
   guide explicitly supports the native History API.
3. Initial load/reload, popstate and hashchange discover the current permitted
   catalog. Match organization/repository/path/revision/digest before any detail
   request; then read through the existing authorized exact-reference tool.
   No old cached content or automatic newer-revision fallback. Paired navigation
   events are deduplicated by the synchronously captured current location.
4. A later navigation closes the previous reader and invalidates old work through
   the existing owner check. Error, session expiry, hidden page or unavailable
   selected projection retains no old content. Refresh stays explicit; no polling.
5. Direct invalid/foreign/stale links show a safe explanation and the currently
   permitted library, without issuing a detail read. A saved link never bypasses
   missing or revoked grants. Exact matching path alone is insufficient.
6. Normal close/Escape/backdrop returns focus and replaces only the current Brief
   location with /. It never calls history.back on an untrusted incoming entry
   or sends the user to a previous external page. Browser Back/Forward from an
   open panel remains supported and reauthorized.
7. Source content remains memory-only, but selected reference metadata can persist
   in the address bar/browser history or user-copied links. State this difference
   visibly; links do not contain credentials or supply permission. No automatic
   clipboard write, external sharing, source exit or analytics event is added.
