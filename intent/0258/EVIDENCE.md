# Development evidence — 2026-09-08

Base: `7033e88059afcfe0f52211c9d692ac7aa4c30dfa`.

## Capability and checks

The combined history reader now verifies both recorded SDK roles against one
unchanged source/operation snapshot and exact predecessor lineage. The new
authenticated HTTP/MCP query returns parsed document output only. The actual
Next editor has an explicit read-only original/current comparison panel.

The focused disposable SQL/SDK suite passed **nine checks plus idempotent
migration**, including composed 34-source assessment and both roles, pending/
partial/complete history, edits and expiry, changing roles, late identity loss,
and earlier-role authority/source changes during the final SDK verification.
Final readback checks all authorities afresh; only exact deterministic SDK
verification is memoized within one read.

Targeted React tests pass complete/partial comparison, exact matching and changed
text, no automatic requests or adoption controls, sanitized failure, source/
identity changes, late responses, hidden-page/session clearing, focus and axe
WCAG 2 A/AA checks with color contrast excluded (JSDOM has no layout engine).
HTTP/MCP, public contract and bounded transport tests pass. An HTTP test initially
used extra fields in its synthetic principal; the identity schema rejected it
with 401. The fixture was corrected, not the authentication policy.

The actual browser-inspection attempt timed out before UI state was returned.
No live visual or signed-in history/provider acceptance is claimed from that
attempt or from synthetic React/HTTP tests. No alternate preview was created.

Final verification passed:

- **1,185/1,185 regression tests**.
- **351/351 PostgreSQL 16.14 integration checks**, including the three new
  combined-history scenarios. Only this run's synthetic container/tmpfs data was
  removed after verification; no real records were migrated or deleted.
- All eight package typechecks plus the prototype typecheck and optimized
  Next 16.3.4 build.
- Kit checks (95), workflow token-scope audit, all 226 local links across the
  13 checked documents, and `git diff --check`.
- Protected Architecture, Exam and accepted retention-policy hashes unchanged.

The first broad regression run exposed missing imports in two existing React
test compilation maps. Both maps now include the actual history component and
transport; no authentication or assertion was weakened. The final full run above
includes both repaired harnesses.

## Authority and provenance

Records and model responses are synthetic. D1 and the proposed $5 first-test
budget remain inactive/unapproved. No credential lookup, paid model call, real
runtime Git save, live migration, gate, authentication bypass, release, deployment
or deletion. The credential skill preserved the resolved decision; Next's local
client/server guide kept UI imports limited to public contracts and presentation.
The one-minute loop remains active. User-owned roadmap/outputs are untouched.
