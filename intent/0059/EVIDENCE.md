# Development evidence

Baseline f982923557efee05b3eb933d18441561133417bf plus this increment.
2026-09-05 UTC. Offline candidate evidence, not independent acceptance.

Four native groups pass. A historical event is re-signed with the ordinary
synthetic event key after its provider signature is corrupted: the frozen public
history oracle returns validated-trigger, while the successor blocks with zero
effects. A valid two-event history passes. No real provider or key is used.

All 27 declared event kinds and five prior negative kinds run through the new
path. The old effects graph surrogate is rejected by the actual closed schema.
Historical negatives cover wrong full binding, pre-key provider time, mismatched
provider ID, foreign organization/item/environment, extra proof fields and extra
event fields. Replay tests include independently re-signed repeated event/provider
IDs with increasing times, avoiding a false pass caused only by time reversal.
Explicit expiry, future evaluation mismatch, noncanonical/oversized envelopes,
record size and history-count limits deny. Success always has zero effects.

`pnpm check` passed under Node 24.20.0: kit and workflow-scope validation,
typechecks, 88 prototype tests, root control/correction tests, all seven package
suites, and prototype/production builds. Unchanged package tasks were served from
the existing Turbo cache; this is not a fresh browser or integration run.
`pnpm install --frozen-lockfile` passed with no dependency changes;
`git diff --check` passed and the frozen review/protected-file diff was empty.
Publication is identified by the Git commit containing this evidence.
No production module or browser changed; the existing browser/manual/operational
boundaries remain. Frozen review/Exam files are untouched.

This is event validation, not history completeness or lifecycle-effect authority.
The effect graph must still consume the exact validated trigger/history and
shared protected-action contract. R5-001/002 remain partial; R5-003 is open.
Independent complete-package review and protected incorporation remain required.
