# Acceptance boundary

The actual SDK-to-SQL fixture must acknowledge the exact request before synthetic
transport and the exact response before returning. Missing request ACK prevents
transport; missing response ACK permits verified readback without a second model
call. Concurrent replay cannot alter ciphertext. Changed inputs, bindings, records
authority, source access, keys, holds or execution state must fail safely.

The SQL guard must reject a quarantine that wins after the adapter's check without
granting draft runtime broad execution access. Recovered evidence must explicitly
deny retry, execution, semantic-quality, clearance and gate authority.

Synthetic identity, source authority, profiles, keys, budgets and provider responses
are not real activation evidence. This is not the canonical Exam or a gate signature.
It does not complete scope-result checkpoints, expired observation access, Temporal,
real semantic evaluation or any I1–I6 signed-in/save acceptance.
