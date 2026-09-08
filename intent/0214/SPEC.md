# Spec

- Mint the draft UUID and creation time on the server. Idempotent creation binds a
  request UUID, fixed owner/org/product and configuration; retries return the same
  original even after expiry, never a replacement or renewed clock.
- Use separate forced-RLS lifecycle metadata, with no conversation text or key
  bytes. Fix the maximum use window at creation + 168 hours. Metadata inspection
  can report expiry/hold but never grants permission to restore or generate content.
- An explicitly authorized originator discard starts its one server-observed
  60-second cutoff. Repeats preserve that observation. It is not deletion.
- Require a distinct trusted qualified-hold verifier before latching the exact
  hold reference; no ordinary hold release. Independently verified publication
  must bind draft, operation/input and exact authoritative timestamp. Future or
  pre-creation publication dates and replaced publication references fail closed.
  Never accept a caller-provided publication timestamp or generic approval flag.
- Earliest fixed/publication/discard cutoff wins. The SQL guard prevents identity,
  configuration, creation/deadline and recorded event rewrites, deadline extension,
  hold release or deletion by the runtime. Preserve unknown acknowledgements.
- Current authorization and evidence ports run outside SQL, have five-second
  bounds, and withhold late/closed outcomes. Hold/publication evidence has a
  five-second monotonic dispatch lifetime. Pool scopes and restricted role checks
  remain mandatory. No source/key/provider calls occur within SQL transactions.
- Supply this actual SQL lifecycle to encrypted original retrieval in the
  disposable Temporal/native-Git test. A hold recorded after queueing must deny
  retrieval before a Git dispatch. No runtime/UI binding or actual key provisioning.
