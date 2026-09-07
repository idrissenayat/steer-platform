# Local UX preview

The user reprioritized functionality and UX on 2026-09-07, deferring further
account-authentication work. Increment 0194 provides a bounded no-sign-in preview
inside the existing Next frontend, not a replacement architecture or live workspace.

## Try it

1. Open `https://localhost:8443/` and choose **Open UX preview**. The existing
   unconfigured preview at `http://127.0.0.1:3000/` offers the same entry.
2. Choose **Create your first intent** or **New intent**. Write freely in one large
   **Write your intent** box: paste notes or describe the idea in your own words.
   No questionnaire or separate title is required. Use non-sensitive sample data.
   The explicit local limit is 100,000 characters. Device dictation can enter text;
   STEER does not record audio or provide a connected voice agent here.
3. Switch to **Review Brief** to read the exact original text. No automatic Brief
   extraction or agent response is claimed. Existing saved Brief details remain
   available for individual corrections, rather than another eight-field form.
4. Choose **Save on this browser**. Nonempty intent or existing notes are required.
   A missing title is labelled from the first nonempty line, without summarizing the text.
   Only a confirmed browser-storage write displays the saved state.
5. Choose **Intent backlog**, find the draft by title, and open it. Reloading the
   page requires reopening UX preview; explicitly saved drafts remain available
   on the same origin and browser profile.

## What is actually stored

Editing stays in memory until explicit local save. Moving between write, review,
and backlog preserves the current unsaved edit buffer. New-intent, open-another-draft,
and exit actions warn before discarding edits. Reload/close requests the browser's
standard unsaved-change warning, which browsers may suppress; this is not autosave.
Returning a field to its saved value clears the dirty state.

New records use format version 2: version, local identifier, save time, exact free-text
intent and preserved structured answers. Version 1 records still read unchanged;
only an explicit save upgrades a record. The historical `steer:ux-draft:v1:` key
namespace stays stable for collision/stale-write protection across versions.
No account/session, repository binding, signature,
approval, lifecycle stage, provider receipt or token is stored. Authenticated
workspace content is never imported into these drafts. No model or provider is called.

Local data is unencrypted and readable by anyone with this browser profile. It is
not synchronized, backed up, tenant-isolated, a durable system of record, or portable
between HTTP/HTTPS origins. Browser data clearing can remove it. Do not put real
sensitive workspace data here. Git remains the intended authoritative artifact store.

Unrecognized/corrupt records are left untouched and reported. Storage failures keep
edits in memory and show an error, not success. Existing records are compared with
the opened snapshot before overwriting/removing them. Detected cross-tab changes
require reopening or saving edits as a new draft. Browser storage is not transactional:
simultaneous cross-tab writes are not guaranteed serializable; this is another reason
it cannot replace the governed save path.

Unsaved-discard warnings are modal: the safe choice receives focus, Tab stays among
the choices, Escape cancels and closing restores focus to the triggering control.
Review/save controls remain visible while scrolling a long Brief.

**Remove this local draft** requires an explicit named-record modal confirmation. It removes
only that preview record and its unsaved edit buffer, without an undo. It never
clears all browser storage or touches GitHub.

## Deliberate boundaries and next work

- Review is a visual review of supplied words, not a gate signature, independent
  assessment or automatically generated Brief. No completion-by-field-count is shown.
- The live authoring component and its expiry/privacy/authorization rules are unchanged.
- Real GitHub saving, verified Flight Board/Inbox inputs, actionable reviews and
  model-backed conversation remain separate work in `JOURNEY-REMAINING-WORK.md`.
- Choose **Learn STEER** in the sidebar, or **Consult the operating guide** beside
  the Brief checklist. The same eight-document canonical reader now works here
  without sign-in. **Return to Brief/backlog** restores the originating view and
  preserves unsaved answers. Reading never saves them. Search/selection clears on
  hiding the page or leaving the guide; no reading interests are persisted.
  This does not duplicate the canon or mark intent/0004 complete.
- Next UX work should use user feedback on this flow and reusable presentation
  components, then bind them to authoritative services as the approved contracts
  become available. Do not carry local draft states into verified business stages.

This feature does not close J1–J6, Gate 2, the five R5 findings, first-real-user
acceptance, or Phase 1. No deployment, spend or broader runtime permissions are authorized.

See [the functionality and UX review](UX-FUNCTIONALITY-REVIEW.md) for verified
behavior, remaining product gaps and a five-minute human test.
