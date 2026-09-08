# Brief

An existing Temporal clarification test intermittently returned attention-required
instead of the expected question state in 0237. That outcome must be investigated
before live acceptance, not hidden by relaxed assertions or automatic model retries.

Reproduce the existing case with bounded, content-free database measurements.
Remove avoidable repeated reads while retaining exact current source, operation,
records, key and lifecycle checks before returning any recovered exchange. Preserve
the one-call clarification behavior and the independent Test Agent boundary.

Non-goals: live provider testing, policy or budget approval, production migrations,
credential changes, auth/UI redesign, scope-result implementation and gate signing.
