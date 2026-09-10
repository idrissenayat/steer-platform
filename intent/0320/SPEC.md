# 0320 — Current-scope lease composition contract

1. Only the exact current-scope reader constructed with independent current
   records/key authority may offer a private projection phase. Pin its read method
   and scope. Copied, wrapped, historical or ordinary readers retain the existing
   full-reader path; an eligible phase failure never falls back.
2. A phase opens one native scope content lease and verifies source/profile,
   recorded SDK observations and current assessment before any consumption.
   Every borrowed read has exact input binding, fresh caller/source checks and
   current lease/expiry guards. Reject expired, superseded or historical output.
3. Keep the development original lease alive inside the phase. Complete development
   records/key comparison precedes final scope records/key comparison. Re-grant
   development purposes through final scope work and return. No policy/result cache
   crosses an effect or independent revalidation callback.
4. The borrowed reader is immutable, non-concurrent, consumed and closed before
   finalization. Reject escaped, unawaited, malformed, caught-failed or foreign reads
   and drain actual held work before resource shutdown. No scheduling inside it.
5. Preserve ordinary read behavior and all existing negative final-scope checks.
   Add direct borrowed-reader tests and native exact-reader success/late revocation/
   final-key and records-race/drain tests. Run both synthetic authenticated journeys,
   focused native start, regression/types/kit/audit and record whole-action counts.

Keep the complete C22 protocol unchanged. No synthetic result establishes live
model quality, runtime save authority or signed-in UI acceptance.
