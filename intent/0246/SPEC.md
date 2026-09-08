# Specification

1. Add a portable browser transport for the existing authenticated scope prepare,
   start and read tools. Send exact references only, with same-origin credentials,
   no-store, no-referrer and redirects denied. Validate strict output bindings and
   combined-result digests. Never call a provider, write browser storage or retry
   implicitly. Bound request/receipt bytes, result bytes, chunks and a 40-second
   deadline. Keep admission until ignored-abort fetch/body cleanup drains.
2. Add an editor controller bound to the current human, exact saved source and
   reviewed corpus. Only an explicit assessment action prepares/starts; progress
   reads cannot create work. Preparation/start uncertainty keeps identical recovery
   references, prevents replacement work and never permits repeated model dispatch.
3. Revalidate findings against the actual reviewed corpus bytes and whole-target
   plan, not merely a response's self-consistent digest. Check source revision,
   scope digest, owner and batch coverage. Preserve pending, incomplete, failed/
   uncertain, superseded, expired, no-sources and unavailable states.
4. Any actual source change invalidates the old review, even after undo. Harmless
   object-field reordering by schema normalization must not be treated as an edit.
   Changed editor input cannot restart an old request. Known progress remains
   readable; terminal verified readback can recover an uncertain start without
   resending. Never replace user text or generated documents from scope findings.
5. Mount controls in the actual development editor. Block conflicting source-review
   or generation actions while this scope request is busy/unresolved. Keep the
   existing server generation gates intact: findings are not an authority upgrade.
   Read progress without model-use capability, but require enabled capability for
   assessment/recovery commands. Scope-tool grants remain enforced by the API.
6. Poll only acknowledged pending work, every two seconds with 900-read/30-minute
   limits, and provide an explicit same-review progress button. Stop on uncertainty,
   terminal state, identity change, expiry, hidden document, pagehide or unmount.
   Unknown starts need explicit recovery or terminal readback, never automatic retry.
7. Display relation labels, explanations, missing/distinct scope, source paths,
   canonical/candidate/amendment status, exact commit/digest and UTF-8 citation ranges.
   Render all findings as inert text. Open supported Brief references through the
   existing reader; retain cited passages for unsupported proposed paths without
   widening reader authority. Show coverage/access gaps without restricted names.
8. Use existing pink/orange classes, wrapping controls/content, native buttons,
   details, status announcements and focused result headings. No new auth, alternate
   preview, real records/model installation, credentials, dependency or migration.
9. Test the actual React component graph and transport with synthetic HTTP only.
   Keep full signed-in visual/keyboard/narrow-screen, real model/records authority,
   semantic quality and exact Git save/reopen acceptance explicitly open.
