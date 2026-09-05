# Spec: Exact assurance time primitives

## Grammar and arithmetic

`exactInstant` accepts four-digit UTC years (0000–9999), real Gregorian dates,
24-hour time and Z. It accepts existing whole seconds or exactly nine fractional
digits. Other fractional widths, offsets, leap-second notation, invalid calendar
dates, numeric inputs and trailing data return null. No default clock exists.

It returns signed BigInt nanoseconds from the Unix epoch. Date is used only to
validate whole-second calendar components; fractions never pass through Number.
`formatExactInstant` bounds the BigInt before conversion and emits Z, preserving
all nonzero fractions as nine digits. Zero fractions emit whole seconds. Thus
explicit .000000000 and whole seconds denote the same instant, but signed bytes
are never normalized or re-signed. Negative epochs use floor division, not
truncation toward zero. Out-of-range formatting throws EXACT_TIME_INVALID.

`exactRetentionBoundary` implements immediate, indefinite, positive integral
PT seconds, P days and P calendar years. It clamps leap day and preserves the
complete fractional instant. An optional valid parent expiry applies an exact
minimum; it cannot make indefinite retention finite. Durations are bounded to
32 characters. Unsupported/zero/negative/fractional durations and overflow deny.
An overflowing class boundary cannot be rescued by an earlier parent cap.

## Adoption and evidence binding

The 0058 shared verifier uses exact instants for registry notBefore/notAfter/
revokedAt and explicitly supplied record/evaluation times. Its existing rule
remains: recorded <= evaluated, and the independently selected key must be valid
at both instants, using half-open windows. A one-nanosecond key window is valid;
expiry or revocation at the evaluation instant denies. The exact record digest,
signature, selector and canonical bytes are still checked unchanged.

The verifier exposes timePolicyDigest. Candidate policies 0058–0067 and the 0060
shared manifest bind it explicitly (including 0061/0062 composition). The 0061
public lifecycleBoundary delegates to exactRetentionBoundary. Policy digests
change; existing signed candidate envelopes are not silently upgraded. Frozen
source files, trust registries, protected Exams and signatures remain unchanged.

## Deliberate compatibility boundary

This does NOT replace all whole-second business parsers or frozen schemas. The
composed lifecycle still rejects fractional event/evaluation evidence through
those existing guards. It does not round fractional inputs into valid legacy
evidence. Whole-second composed fixtures continue to work. End-to-end adoption
needs a separately explicit successor schema/time contract and all native/as-of,
freshness, authority, replay and receipt comparisons checked at exact precision.

The helper also does NOT make an expired historical key current. An old proof
cannot pass a future audit merely because a fresh key exists. Tests use isolated
synthetic old and future registries to establish that distinction, without
editing frozen keys, accessing providers or claiming approved rotation lineage.

Errors remain fixed/content-free; no credential, gate, spending, deletion or
execution authority is created by parsing, formatting or validating a signature.
