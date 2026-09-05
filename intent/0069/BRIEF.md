# Brief: Exact assurance time

The accepted retention policy specifies UTC nanosecond timestamps and half-open
intervals. The frozen helper supports only whole seconds; calendar arithmetic
uses JavaScript Date. Silent rounding would be unacceptable for key expiry,
revocation, the raw-erasure deadline or a parent cap.

Provide an exact, bounded time foundation and adopt it at the shared signature
and retention arithmetic boundaries. Preserve whole-second compatibility,
explicit clocks, current-at-both-instants trust requirements and typed denial.

Non-goals: changing frozen policy/schema/registry files, relaxing old-key expiry,
introducing archival signing authority, making legacy business schemas accept
fractions, provider access, deletion, production enablement, release or spending.
