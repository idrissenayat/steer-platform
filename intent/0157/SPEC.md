# Spec

Only a strict committed, non-gate-signing receipt produces a canonical local Brief
fragment. Map organization, repository, path, recorded revision and recorded content
digest exactly. Exclude subject, operation ID, request digest, branch, expected head,
blob identity, source bytes and all authority claims. Noncommitted or malformed
observations produce no link. Reuse existing fragment encoding/validation.

Show a native, keyboard-operable 'Read the recorded Brief' link only while the
committed status remains displayed. It performs no prefetch, write, model call,
automatic navigation or new backend capability. Prevent activation after display
expiry or hiding. Existing status edit/expiry/lifecycle clearing removes the link.
Use existing pink/orange styling and explain that current library access is required.

The existing library must re-fetch current catalog/access and accept only the exact
recorded tuple. A missing/stale reference must not substitute the latest revision;
denied grants must not reveal content. Keep normal native Back/Forward and fragment
semantics. On successful keyboard opening, focus the dialog close control; on close,
return to the receipt link when present or the corresponding library card if the
link expired. Receipt navigation must not alter the current draft or imply a gate.

Verify against native seeded Git history ingested through the production reader
into a separate explicitly curated disposable PostgreSQL projection. Test the actual
receipt link, byte-for-byte recorded content, current grant denial/restoration and
a later projection revision that makes the old receipt unavailable. Test helpers
may clean up only their exclusively owned synthetic projection rows/events; no
real records or production profiles are touched.
