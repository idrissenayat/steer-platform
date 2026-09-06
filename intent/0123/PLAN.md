# Plan

1. Add closed create/readback contracts and a typed trusted writer seam.
2. Compose exact preview regeneration, content/base/actor/key binding, current
   authorization, prior-operation inspection, one CAS dispatch and safe readback.
3. Exercise duplicates/concurrency, drift, hostile structure, scope/grant denial,
   current authority, lost acknowledgements, post-dispatch revocation and bad receipts.
4. Verify default-disabled HTTP/MCP behavior and repository checks; publish only
   the tested candidate with explicit port-vs-production evidence boundaries.

## Next implementation

- Build the GitHub writer adapter against this contract using isolated provider
  responses and real disposable Git fixtures where useful. Verify exact expected
  head, absent artifact/operation marker, atomic creation, narrow token permissions,
  bounded I/O, exact readback and lost acknowledgements. No live write invocation.
- Build the full trusted write-authority composition and source revision fencing.
  Existing normalized gate-policy evaluation alone is insufficient. No approved
  Gate 2 record currently exists for runtime enablement.
- Extend curated Brief discovery/read parsing to canonical `items/NNNN-slug/BRIEF.md`.
  It currently admits root/legacy `intent/NNNN/BRIEF.md` only. This is an explicit
  integration gap, not a reason to put new runtime artifacts in a noncanonical path.
- Then connect exact confirmation/save-status UI, ingestion/board and decision
  review. Keep agent/model conversation and trusted system context visible as gaps.

The five R5 findings, 0120 archive work and signed Phase 1 obligations remain open.
The local adapter development is unblocked; its activation still needs full gate
evidence and separately approved provider write scope. No new generic continue is
needed, and the spending/deployment/release boundaries are unchanged.
