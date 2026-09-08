# Draft history contract

1. `load(draftId, revision)` accepts `latest` (default) or an integer 1–1000.
   Numbered reads use the existing authenticated `intent.draft.read` endpoint.
   Invalid selectors cannot send a request; uncertain writes block navigation.
2. Explicit `restoredMode` distinguishes latest from history. Numbered reads remain
   history-only even if they happen to return the current highest revision.
   `acceptRestore` must reject them at controller level, not merely hide a button.
3. Previous/next controls use returned revision metadata and focus the preview
   heading. Show exact original text, clarification and preserved documents with
   existing safe Markdown rendering. Show the latest number as observed at read
   time, never a permanent freshness guarantee.
4. History reads change neither current content nor its preserved optimistic save
   base. Closing history retains an unresolved conflict. Fresh latest-mode read and
   explicit replacement are required to load a new base. Existing CAS still
   rejects a concurrent server edit on a later save.
5. Denied/missing/invalid reads clear old preview content and preserve current work.
   Reject substituted draft/revision and latest metadata below the controller's
   observed bound. Do not recreate missing records or silently retry/skip versions.
6. Close/session change/hide clears private history and drops late replies. Keep
   current source/owner/product/records/key checks, false saved/gate claims and the
   actual pink/orange application. No auth bypass or localStorage persistence.

No new server grants, schemas, migrations, dependencies, storage activation or
provider access. Expired/superseded agent observations and older/orphan run
recovery remain separate from stored draft snapshots. No historical rebase/rollback.
