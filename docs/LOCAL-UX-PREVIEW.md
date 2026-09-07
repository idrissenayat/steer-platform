# Local UX preview

The user reprioritized functionality and UX on 2026-09-07, deferring further
account-authentication work. Increment 0194 provides a bounded no-sign-in preview
inside the existing Next frontend, not a replacement architecture or live workspace.

## Try it

1. Open `https://localhost:8443/` and choose **Open UX preview**. The existing
   unconfigured preview at `http://127.0.0.1:3000/` offers the same entry.
2. Choose **Create your first intent** or **New intent**. Supply a working title
   and whatever you know in the eight Brief fields. Use non-sensitive sample data.
3. Switch to **Review Brief**. Unknown fields stay visible. Each correction link
   returns focus to its corresponding field.
4. Choose **Save on this browser**. A title is required; other facts can remain open.
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

Each local record contains only version, local identifier, save time and answers,
under a `steer:ux-draft:v1:` key. No account/session, repository binding, signature,
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

- Review is a visual review of supplied facts, not a gate signature or independent
  assessment. Eight completed fields do not imply a complete or approved Brief.
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
