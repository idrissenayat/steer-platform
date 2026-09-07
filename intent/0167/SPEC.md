# Spec

A server-owned display switch may expose submission controls only when exactly
enabled; it defaults closed and does not install a writer or confer permission.
No live environment is enabled. The API independently rechecks current identity,
full authority, exact bytes and source CAS on every operation.

Only an explicit click on a currently reviewed draft may submit. Bind the original
draft, preview digest, subject, destination/path and observed head to one generated
UUID-v4. Preserve immutable request identity and allow at most one submission per
mounted authoring session. Editing, duplicate clicks, unknown/not-found status,
transport errors or timeout must never automatically resubmit. Use a separate
bounded HTTPS same-origin mutation transport; do not widen the read-only transport.

Recompute preview and request digests; committed responses must match the entire
reference, request digest, head, source digest and Git blob. Status checks reuse the
same operation ID with current session access, independently of destination display
expiry. Show original operation identity and explicit uncertainty, not a false save
or gate signature. Receipt details/source links require exact validated output.

Keep submission feedback outside the 15-second destination subtree. Close and
discard late results on hidden/pagehide/session expiry/unmount, preserving the
in-memory attempted latch so no second submission follows clearing. No storage,
background polling or automatic retry. Explain retaining the operation ID before
leaving the page; reload recovery uses the existing previous-operation read UI.

Test current Keycloak/Git membership and actual native Git creation through the
production request-owned writer. Gate authority/provider transport remain synthetic
and isolated. Default/held UI stays disabled. Validate recovery, grant denial,
responsive/keyboard/automated accessibility and all regressions; no live activation.
