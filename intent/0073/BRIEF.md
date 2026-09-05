# Brief: Pre-terminal raw grant evidence

The accepted raw-data policy requires a grant before sanitization completes,
followed by deterministic disposal without a fresh human decision for each
object. The existing candidate instead asks for approval over post-terminal
state. Backdating validFrom cannot satisfy this requirement.

Separate pre-terminal preparation and human enrollment from later execution.
Verify the exact prepared objects, provider bindings, sanitizer/inspector,
scope, signed human decision and complete enrollment evidence before the
named terminal event. Preserve all human proof checks and exact time rules.

This bounded foundation does not implement batch consumption or disposal.
Current-state and per-copy execution checks remain mandatory follow-on work.
