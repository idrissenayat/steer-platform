# Implementation plan

1. Add an explicit reconciliation boundary around verified provider readback and
   the existing durable checkpoint transition; keep those I/O phases separate.
2. Verify exact repeated checkpoints, acknowledgement loss, revoked/missing authority,
   corrupt/absent receipts, proof expiry and unchanged failed/quarantined states.
3. Run regression/type/control checks, update evidence and publish owned changes.

Next: implement disabled original-payload persistence and current lifecycle/full-
corpus/authority composition, then durable development roles and actual UI wiring.
Keep explicit quarantined-outcome resolution separate; no retries or policy/gate
adoption arise from checkpoint reconciliation.
