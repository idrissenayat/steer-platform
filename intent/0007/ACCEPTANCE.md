# Development acceptance checklist

These checks are written before implementation. They are not a protected Exam
or a Gate 2 approval.

- An allowed, unexpired principal obtains its context via direct dispatch and
  HTTP with identical results.
- Missing/malformed/expired identity, missing grant and wrong organization are
  denied. Caller role headers and body role properties confer no authority.
- Unknown tools and inherited object property names are unavailable.
- Malformed JSON, extra input fields, non-JSON and oversized bodies fail with
  consistent errors and without echoing supplied content.
- OpenAPI paths and input/output schemas are generated from the registry.
- Output-schema failures return an internal error without leaking handler data.
- Liveness is 200; readiness is 503 with explicit missing dependencies.
- Default Node startup serves the documented routes and denies tool calls.
- Root typechecks, tests and builds remain green.
