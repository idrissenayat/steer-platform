# Development specification

1. Unsaved-discard and exact-draft removal confirmations use labelled native modal
   dialogs. Background actions cannot remain interactable during confirmation.
2. Initially focus the non-destructive choice. Tab/Shift-Tab wrap between the two
   choices; Escape cancels. Closing restores focus to the opener if still connected.
3. Cancelling keeps the edit buffer and stored draft unchanged. Removing continues
   to require explicit confirmation of the named local record; no bulk clearing.
4. Keep Review/Write and explicit browser Save controls visible during long-form
   scrolling. Focused fields have scroll clearance and narrow layouts remain usable.
5. Decorative field numbers are excluded from accessible input names. Labels and
   existing helper descriptions remain associated with their inputs.
6. Exercise save failure and retry, missing-title focus, saved reopening, correction,
   guide return, keyboard cancellation and narrow-screen layout. Report test scope
   and product limitations separately from implementation success.

Persistence and authority contracts are unchanged. No new dependencies or kit edits.
