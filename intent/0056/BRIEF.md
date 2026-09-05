# Brief: Close the Unicode-phone detector gap

## Problem

The final R5 Critic demonstrated that the frozen privacy candidate accepts
Arabic-Indic international phone numbers. NFKC alone does not map these decimal
digits to ASCII, so the existing phone pattern misses them.

## Proposed outcome

The exact counterexamples are rejected by a source-preserving correction using
all decimal digits in the pinned Unicode data, without weakening prior evidence
validation or rewriting the frozen review history.

## Outcome contract

Reproduce frozen acceptance and corrected rejection of both reported examples,
plus another non-Latin script and supported encoded variants. Verify all 770
Unicode 17 decimal digits and 6/7/15/16-digit and letter-embedding boundaries.
Retain all prior privacy graph and phone-case decisions. Independent acceptance
and protected incorporation remain prerequisites for formal finding closure.

## Constraints

No live provider, source deletion, real user data, signature or deployment.
The normalized inspection copy never replaces signed evidence. The phone helper
is not a complete PII detector, sanitizer, approval or production analytics binding.

## Sizing and scoping

One of five exact M0 findings: Unicode-phone normalization and its regression
candidate. Do not expand into another broad assurance cycle or change R5-001–004.

## Domain tags

Privacy, source integrity, assurance. Labels do not confer authority.

## Affected users and systems

Future privacy consumers and the offline assurance path; no live consumer enabled.

## Open questions

After all five corrections: independent Test Agent/Critic review, protected
incorporation and exact-revision human rulings through the established path.
