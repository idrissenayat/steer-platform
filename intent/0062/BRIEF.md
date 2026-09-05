# Brief: Bind migration evidence to authority and actual state

R5-003's old graph could report a journaled effect without exact target or
implementation binding, shared runner authorization or authoritative replay/CAS.
Its before/after governance digests were constants rather than supplied bytes.

Implement a separate closed successor that requires an independently selected
plan and before-state pin, domain-signed backup/rehearsal evidence, actual supplied
state, and the complete shared migration action check. The proposed post-state
must equal a deterministic approved transformation; protected source bytes must
remain identical. Provider observations, journal and result must bind the same
request. Contract cleanup requires full qualified human evidence for the exact
plan, backup, columns, operations, tenant and input.

Keep execution offline, preserve the frozen send-back package and document the
bounded model and unverified concurrency/live-runner obligations honestly.
