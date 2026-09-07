# Development specification

1. The existing Next root offers an explicit **Open UX preview** entry independently
   of sign-in. Its client tree replaces, rather than mixes with, the live workspace
   while open. No provider endpoint or authority contract changes.
2. Reuse the eight current authoring field definitions. The local renderer presents
   literal user text, not HTML/remote assets and not canonical committed Markdown.
3. Provide empty backlog, title search/no results, detail, write/review switching,
   field-specific correction focus and a missing-field checklist.
4. Drafts stay in memory until **Save on this browser**. Require a title. Persist
   one strictly validated, versioned record per local UUID, with updated time and
   answers only. Explicit success follows storage write/readback.
5. Preserve unsaved changes across internal view changes. Warn before replacing
   the edit buffer or leaving preview, and register a dirty-only beforeunload warning.
6. List and reopen only valid preview-prefixed records. Preserve/report unreadable
   records and unrelated storage. Handle denied/quota/unconfirmed writes honestly.
7. Compare opened bytes before update/removal to detect existing stale writes;
   offer save-as-new. Do not claim transactional cross-tab consistency.
8. Removal targets exactly one local draft after inline confirmation; no automatic
   expiration, broad storage clearing, server deletion or GitHub mutation.
9. Preserve responsive pink/orange tokens, semantic controls and correction focus.
   Distinguish all local progress from live saves, review authority and signatures.

No library, dependency, schema, GitHub App permission or authentication changes.
