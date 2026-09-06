# Brief

While preparing authority composition behind the 0132 writer, two current-source
prerequisites accepted a clock rollback that remained later than the operation's
start time. Gate collection also lacked a caller deadline for stalled source reads.
These paths must not return apparently current evidence after the observation
clock regresses or a read exceeds its allowed duration.

Correct both reproduced clock bugs and give the existing gate observer bounded,
single-flight collection with safe late-result rejection and draining shutdown.
Preserve all existing source-byte, identity and no-authority semantics. Do not
change gate policy, signatures, provider access, runtime enablement or signed scope.
