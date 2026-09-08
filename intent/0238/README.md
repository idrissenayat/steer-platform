# Clarification reliability under database latency

Reduce repeated observation verification without weakening current authority or
silently retrying model calls. This is a backend reliability increment, not live
intent-journey acceptance.

- [Brief](BRIEF.md)
- [Specification](SPEC.md)
- [Plan](PLAN.md)
- [Acceptance boundary](ACCEPTANCE.md)
- [Development evidence](EVIDENCE.md)

The recorded development worker now verifies an immutable request/response pair
through one initial source/operation context and its final recheck. Both encrypted
stages, historical keys, records authority and lifecycle remain independently
validated. The pinned SDK still checks the exact wire exchange and parsed result.
There is no cross-call cache, longer timeout, new retry or new runtime authority.

A bounded, explicitly selected diagnostic runner reproduces the existing Temporal
clarification case against disposable PostgreSQL with optional synthetic SQL delay.
Focused results are never labeled as the full suite. Historical intermittent-failure
causality remains unconfirmed; evidence identifies the narrower reproduced mode.

Continue successful scope checkpoints, reference-only Temporal, real authority
binding and the actual signed-in/save journey. D1 is unsigned/inactive; the first
live model budget is still unapproved. No real records, migrations, credentials,
provider calls, runtime Git writes, gates, release or deployment are activated.
