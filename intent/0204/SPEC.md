# Spec

- Maintain separate generated originals and editable copies for all three documents.
- Provide Read your draft, Edit draft and View generated original modes within the
  existing conversation. Preserve each document's edits when switching documents or
  viewing originals. Source text and clarification remain visible as inert text.
- Preserve exact correction text, including Unicode and blank intermediate edits;
  show a warning for empty drafts. Limit each editor to 30,000 characters.
- Render draft/original Markdown with the existing inert renderer. Never execute
  embedded HTML or load external images. No model or save request occurs on edits.
- Identify unsaved human corrections and state that Test Agent review has not rerun.
  The generation fingerprint describes generated source context, not edited bytes.
- Lock original source and direction once a bundle exists to prevent accidental
  regeneration/overwrite while reviewing. Server/durable versioning must precede
  the future source-revision/regeneration path; do not silently discard edits.
- Keep current session-clearing behavior and prominent unsaved/expiry warning.
  Changing identity/repository clears original and edited content. Late work from
  an old transport cannot publish into the new identity's state.

This does not implement persistence across refresh, navigation, visibility clearing,
expiry or restart. Those remain mandatory I4 acceptance, not waived requirements.
