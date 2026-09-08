# Implementation plan

1. Implement a disabled authenticated-envelope and immutable SQL-original adapter.
2. Verify isolation, exact reconstruction, retention denial, concurrency, corrupted
   copies, lost acknowledgements, current authority and workflow consumption.
3. Preserve the real migration hold; document limits, run regressions and publish
   only this increment's owned changes.

Next: authoritative draft lifecycle/key recovery controls, versioned draft and
generation checkpoint services, durable Architect/Test Agent execution, full-source
current-authority composition and actual UI integration. D1 adoption and separately
approved live model/save activation remain prerequisites, not test results.
