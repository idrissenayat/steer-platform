# Development specification

## Reproduced defect

`evaluateGateDecisionPolicy` accepted a signature one nanosecond after evaluation
and authentication one nanosecond after signing because `Date.parse` discarded
the fractional difference. It also rejected a correctly ordered Critic,
authentication and signing sequence separated by nanoseconds. Three regression
groups failed against the pre-change code while all eight existing groups passed.

## Exact domain primitive

Add provider-free `@steer/domain/utc-instant` with
`parseUtcInstant(unknown): bigint | null`. Accept four-digit-year UTC timestamps
with required whole seconds and an optional one-to-nine-digit fraction. Validate
the whole-second calendar by exact Date round trip, then add the padded fraction
as integer nanoseconds. No fractional digits pass through floating point. Reject
offsets, invalid dates, leap seconds, surrounding whitespace, expanded years,
non-string values and precision above nine digits. Validate bounded length first.
Support pre-epoch instants and years 0000–9999 without the Date constructor's
two-digit-year interpretation. Equivalent fractions represent the same instant.

This production parser follows the exact-integer approach exercised in the
existing 0069 offline candidate but does not import its prototype/frozen evidence
dependencies. Unlike that canonical evidence profile's whole-second-or-nine-digit
grammar, normalized gate facts preserve common one-to-nine-digit UTC input forms.
No frozen policy/schema or historical evidence grammar is changed.

## Gate policy integration

Use the exact validator at all five timestamp locations: signature authentication,
signature time, prerequisite signature time, Critic report time and evaluation
time. Compare integer instants for all existing chronology and session-consistency
rules. Preserve existing strict/non-strict comparisons: authentication may equal
signing, signatures may share a time in valid sequence, but signing and the closed
commercial Gate 3 second-look authentication must follow the Critic strictly.

Keep full SHA/digest lengths exact, including rejecting trailing newline forms.
Do not serialize BigInt or change the result shape/reason identifiers. Every
result still carries `sourceVerificationRequired: true`; `policy-satisfied` is
not approval, a human signature, a verified second look or write authority.
This change enforces chronology of input facts, not a new minimum wait between
ceremonies. Actual provider/session evidence remains indispensable.

## Compatibility and limits

Whole-second and millisecond callers retain semantics. One-to-nine-digit inputs
are compared exactly; more precise inputs now fail closed instead of rounding.
This is an internal pure-policy schema tightening, not an HTTP/persistence
migration. Existing OIDC/browser and membership timing contracts are unchanged.
No live gate/provider adapter or runtime writer is installed by this work.
