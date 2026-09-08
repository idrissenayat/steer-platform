# Plan

1. Separate expired metadata inspection from every execution mutation API.
2. Add explicit historical result reading with current authority and no checkpoint
   continuation reference or expired-job fallback.
3. Verify actual clock expiry, read-only SQL, no state/spend changes, current
   access/hold/revision checks and timeout/close handling in disposable tests.
4. Document the delivery boundary and publish verified owned changes.

Next: original prompt/evidence envelopes and provider provenance; durable reference-
only development activities; actual editor acknowledgement/conflict/restore wiring.
Do not activate live persistence, models or GitHub writes under these test grants.
