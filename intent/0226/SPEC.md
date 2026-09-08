# Specification

1. Add a browser-portable same-origin HTTPS transport for only the existing
   `intent.draft.create/append/read` endpoints. Send authenticated cookies without
   bearer credentials, redirects, caches or referrers. Ordinary input stays within
   16 KiB; append within 256 KiB. Bound response bytes (600,000), chunks (10,000)
   and total request time (40 seconds), including ignored-abort fetches and stalls.
   Validate shared schemas, echoed IDs/revisions, lifecycle order and scope hashes.
2. Keep one in-memory controller per verified session/organization/product/repo.
   Creation acknowledges a reference only. Append captures exact source, ordered
   clarification turns (including empty turns), and nullable Brief/Spec/Exam bytes.
   Only a validated acknowledgement marks its own revision preserved. Compare the
   current editor content separately; never replace newer typing with an ACK.
3. Unknown/unavailable responses and HTTP failures retain the exact create request
   or append mutation, including its original content and expected parent. No
   automatic retry or new write/read is permitted while it remains uncertain.
   The explicit retry reuses that request. A post-write 401/403 is not rollback
   evidence. An old successful mutation with a newer latestRevision enters conflict.
4. A conflict blocks further appends from that base. Read current stored content
   into an inert preview, not the editor. Reject a latest read already reported as
   stale. Explicitly replacing the editor adopts the read revision/digest as the
   next CAS base. It is a point-in-time read: a later edit can still conflict.
   Dismissing a preview leaves the current text/base untouched and cannot clear an
   existing conflict. Move keyboard focus to the preview, restored document/source,
   or initiating control as appropriate.
5. Restoration clears previous agent result/provenance, direction confirmation and
   review state. All three documents remain editable and source text/clarification
   remain verbatim. Do not synthesize a generation digest, generated-original tab,
   Test Agent authorship, passing Exam, save consent or gate signature from bytes.
   Document edit version is distinct from the acknowledged server draft revision.
6. Preserve current memory-only privacy behavior: no localStorage/sessionStorage,
   URL content, background retry or autosave. Hiding, expiry, backwards clock,
   unmount or identity/scope change clears private editor/recovery state and
   suppresses late results. Explain that pending work may have reached the server
   and that refreshing loses the in-page exact request. A known draft reference
   can be entered after reauthorization; automatic owned-draft discovery is next.
7. Integrate into `IntentConversation` and its existing authenticated page, not a
   new route or preview. Display configuration is explicitly off by default:
   `STEER_WEB_DRAFT_EDITOR=enabled` plus a validated
   `STEER_WEB_DRAFT_PRODUCT_ID`, and the verified gateway repository display hint,
   are required to show controls. These server deployment values are display
   hints only: they neither install the service nor supply records/tool authority.
   No real environment values are changed by this increment.
8. Recorded-development start/status/result integration remains separate. The
   earlier one-follow-up live agent transport cannot represent restored multiple
   turns; block that shortcut rather than silently omit history. Restored turns
   are retained read-only and re-preserved exactly. Generated documents remain
   subject to fresh scope/conformance/Exam review and separately authorized Git
   publication. D1 and I1–I6 live acceptance remain open.
