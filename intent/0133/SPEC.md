# Spec

## Membership timing

`createGitWriteMembershipVerifier` compares each observed clock value with the
previous observation, not only the operation start. Equal timestamps remain valid.
Any nonfinite or regressing clock rejects. Existing fifteen-second logical and
real deadlines, exact source/session checks and no-gate/no-write output remain.

## Gate observer timing and lifecycle

`createGitGateObserver` retains its existing constructor and `observe`, `collect`,
`status` and `shutdown` interfaces. Each underlying run owns a fifteen-second real
timer and monotonic wall-clock guard. Authenticate and source reads are checked
before/after awaits; initial/final head and inventory reads are checked before
their results can become evidence. Nonfinite start denies before authentication.

The exact logical deadline is closed: elapsed time of 15000 milliseconds is too
late. A real timer rejects callers even if an arbitrary source never resolves.
The still-running source remains owned: both observe and collect reject overlapping
admission until it settles. When it returns, the expired guard rejects before any
next source call or usable result. No cached success replaces a failed run.

Shutdown retains draining semantics: it prevents new work and waits for actual
owned work, including a source that outlives its caller deadline. It does not
promise to cancel arbitrary dependencies or resolve while they remain hung.
Normal in-flight work may finish during shutdown, matching the existing contract.

## Compatibility and limits

The legacy three-field public observation shape, immutable collected source bytes,
exact head/hash checks, send-back provenance and explicit no-gate/no-write flags
stay unchanged. No record format, proof requirement, granted hat or human signature
is inferred from timing success. Real provider outage/cancellation and full source/
human/qualification/policy verification remain separate acceptance obligations.
