# Spec

- Add a separate `--browser-recovery` mode and package command. Preserve `--browser`
  success behavior and the standalone `--recovery` integration. Provision the
  additional recovery account only in recovery modes, inside the disposable realm.
- Carry the actual browser operation's status callback, exact saved revision and
  operation ID through the existing durable projection harness. Do not fabricate
  a recovery receipt, second save, human signature or gate result.
- Fail the original actual Temporal activity through current projector revocation
  after receipt readback, before SQL. Preserve its exact FAILED execution/run.
- Configure a separately owned recovery identity runtime and fixed failed-run plan.
  Deny swapped dispatcher tokens, wrong failed-run IDs and ordinary dispatch grants
  without consuming the recovery attempt. Recover only on a separate queue.
- Reconstruct the queued recovery client/runtime; retain duplicate rejection and
  worker reconstruction. Revoked projector access must deny before receipt/SQL.
- Verify the exact original saved revision projects once, the original remains
  FAILED, replay consumes no receipt, and repeated original/recovery starts fail.
  Existing SQL assertions must observe exactly one event, and browser checks must
  open the exact recorded Brief with exactly one original provider mutation.
- Recovery revocation denies start/status without revoking the projector. History
  excludes identity subjects, credentials and private Brief content. Drain and
  close only owned disposable workers, clients, databases and issuer resources.

No production logic, frontend, dependencies, schema, protected artifact or live
grant changes. Integration evidence is not full governed authority or Gate 2 proof.
