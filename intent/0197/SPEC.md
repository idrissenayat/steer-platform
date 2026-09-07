# Development specification

1. New intent opens one labelled multiline text area, initially focused, with a
   visible 100,000-character limit. Enter inserts a newline; no implicit send.
2. No required title or eight-question/checklist intake. Saving nonempty intent
   derives a label from the first nonempty line, bounded to 100 characters. Original
   text, whitespace and line breaks stay separate and unchanged.
3. Review shows exact source text, not a synthetic agent summary. Existing nonempty
   Brief details are preserved; each may be corrected individually from review.
4. Browser record version 2 adds required string `intent`. Read version 1 without
   mutation; explicit save upgrades in the existing key namespace. Reject extra,
   malformed and unsupported data. Keep expected-byte conflicts and confirmed writes.
5. Guide navigation, unsaved confirmation, failure recovery, local removal and
   source rendering stay safe. No provider requests or identity import.
6. Device dictation is an OS capability, not implemented STEER voice. No fake agent
   messages, inactive send/microphone buttons or generated Brief claims.
7. Update current UX guidance and remaining work; historical evidence stays historical.

This does not enable GitHub saving, models, audio capture, signatures or deployment.
