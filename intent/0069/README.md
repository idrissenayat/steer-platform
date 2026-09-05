# 0069 · Exact assurance time primitives

Adds BigInt nanosecond instants and calendar retention arithmetic. The shared
0058 signature verifier checks key activation, expiry and revocation without
rounding; 0061's public boundary helper preserves fractions and exact parent caps.

This is a precision foundation, not end-to-end fractional-time enablement or
archival authority. At 0069 delivery, legacy event/business checks still rejected
fractional inputs. Increment 0070 subsequently adopts explicit precision schemas
and comparisons for the human/event/action/lifecycle path; other paths remain
separate. No frozen trust windows or records are changed.

Read BRIEF, SPEC, PLAN, development ACCEPTANCE and EVIDENCE. Gate 2 stays open.
