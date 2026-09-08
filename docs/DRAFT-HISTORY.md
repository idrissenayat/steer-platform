# Reviewing preserved draft history

0251 adds revision browsing to the **actual authenticated intent conversation**,
using its existing `intent.draft.read` service. This is not a separate preview or
browser-storage history. Real server persistence still requires the inactive D1
records amendment and authorized runtime composition; this feature does not
activate either. Synthetic UI tests are not signed-in human acceptance.

When an authorized draft service is available:

1. Choose **Review stored revision**, **Find my drafts → Review this draft**, or
   reopen a draft by its reference. The first read requests the latest revision.
2. Use **Previous stored revision** and **Next stored revision** to inspect exact
   numbered snapshots. Intent, clarification and any preserved Brief, Spec and
   Exam are shown. The heading says **history only**, with the revision and latest
   revision observed at read time. Keyboard focus moves to that heading.
3. Historical views are read-only, even when “Next” reaches the newest number.
   They cannot replace current editor text, change its optimistic save base,
   preserve another revision, run an agent or restore scope/Exam/gate authority.
4. Choose **Keep my current text** to close the preview. Unsaved edits remain
   unchanged and an existing revision conflict remains unresolved.
5. To load the newest content, choose **Review latest revision**. This performs a
   fresh server read. Only that latest-mode preview offers the existing explicit
   **Replace editor with this stored revision** action. It replaces the editor,
   not stored history, and requires fresh scope and document review. A later
   concurrent edit still causes the normal compare-and-swap conflict on saving.

Every navigation action rechecks current owner/product, records access and key
authority through the same authenticated read endpoint. A denied, missing,
corrupted or expired read clears the preview and leaves current editor text
unchanged. It does not skip to another revision or reconstruct deleted records.
Backward latest-revision metadata and substituted draft/revision responses are
rejected. Unknown write acknowledgements must be recovered before history reads.
Session closure/hiding discards private in-page history and late responses.

This covers **preserved draft snapshots**. It does not yet expose expired scope
observations, superseded assessed development originals, older/orphan agent runs,
or arbitrary historical GitHub bundles. It does not rebase an older snapshot onto
the latest draft or provide an automatic rollback. Current auth, retention, model
budget and Git write boundaries are unchanged.
