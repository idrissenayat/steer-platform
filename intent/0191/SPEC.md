# Spec

Expose only the existing portable lifecycle schema as a dedicated package export;
keep provider/registry-root imports forbidden in browser code. Extend the static
boundary test narrowly to that schema and assert its dependency closure. There are
no dependency/version changes or changes to protected EXAM/CI authority.

Add a request-owned browser controller using the existing bounded same-origin read
transport and only `intent.brief.artifacts`. Pin/copy the exact Brief tuple at
construction, reject malformed or substituted response tuples, preserve null Brief
versus successful coverage, and never accept stage or gate/write authority. Copy
returned views to prevent caller mutation. Every reload clears old fingerprints.

No request occurs on construction or render. One request may be in flight; clear,
close, expiry and invalid/backward clocks abort it and prevent late publication.
Expired/closed instances cannot resume. Clearing allows a new explicit check and
an earlier response cannot overwrite it. Failure reports only a generic message.
Do not persist sources, secrets or fingerprints in browser storage.

Mount **Supporting documents** in the selected review workspace and Brief dialog.
Use three responsive semantic cards with textual states, the selected commit and
expandable hashes. Do not infer source bodies, document completeness or lifecycle
stage. Add cancel/clear with keyboard focus restoration, status announcements,
unique section IDs and clearing on page hide/visibility/session expiry/unmount.

Validate through actual disposable Keycloak, native Git, PostgreSQL and production
Next. Synthetic curation/grants may be extended only inside owned fixtures. Prove
exact source fingerprints, explicit collection, denial clearing, restored access,
keyboard focus, page lifecycle clearing, responsive layout and accessibility.
No live curation/grant, gate action, provider/model access or deployment is enabled.
