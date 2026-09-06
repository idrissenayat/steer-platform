# Brief

The reference owner profile binds evidence identifiers but does not establish that
the complete matching bytes are present and retained. Add a bounded content
verifier for exact target versions/references, explicit verification records and
independently observed current retention. Missing, partial or substituted content
must not pass solely because a digest or complete=true was supplied by the caller.

Preserve full source signature, selected trust, freshness and zero-effect boundaries.
Qualified revocation/event/history and actual reference-state completion remain
separate integration requirements; this increment must not admit erasure.
