# Spec

Use the existing authenticated catalog, current-access reader and canonical Brief
fragments. Replace generic cards in the same Brief library with responsive rows
showing path-derived identity, full source path, full selected revision and an
expandable content fingerprint. Show returned count and the current 20-row range;
retain existing pagination. Catalog presence is not proof that Git is current or
that other Briefs do not exist. Add no search, new API, browser storage or polling.

Make the selected revision a native same-origin fragment link containing the exact
organization/repository/path/revision/content-digest tuple and no identity, source
content or authority fields. Retain the existing Read button. Link activation uses
the existing location handler, which refreshes catalog membership and reads only
the exact permitted tuple. Unavailable or stale revisions never fall back to HEAD.
Expiry, hidden pages or busy/disabled display deny activation; opening the URL in
another context must independently reauthenticate and recheck current access.

Preserve modal keyboard containment and return focus to the initiating current
revision link after catalog DOM replacement, or the existing corresponding Read
button when necessary. Preserve receipt-link focus handling and Back/Forward/reload.
Metadata and expanded fingerprints clear with the same library failure, hiding and
session-expiry lifecycle as source details. No new approval or stage inference.

Keep the established cotton-candy pink/orange theme and readable wrapping at mobile
width and enlarged text. Use semantic list/links/details and existing UI primitives;
no dependency, stack, authentication or hosting migration. This is projected-work
inspection, not the authenticated lifecycle Flight Board, Inbox or Gate acceptance.
