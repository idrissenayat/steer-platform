# Implementation plan

1. Share the existing bounded native-CAS transport; preserve Brief-store behavior.
2. Add strict confirmation-bound candidate storage and original-operation readback.
3. Exercise native Git with synthetic provider/proof ports, including concurrency,
   uncertain outcomes, all-file corruption, stale confirmation and proposal boundaries.
4. Run regression/type/security checks, document evidence and verify branch push.

Next: implement durable operation uniqueness, atomic claim/reservation/fencing and
checkpoints against a disposable database. Then compose verified lifecycle/source
authority and final UI save/reopen. No live provisioning or authority is implied.
