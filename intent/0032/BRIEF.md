# Recover projections without relying on every delivery

The platform can ingest/read one artifact, but needs a bounded recovery operation
for multiple artifacts after missed updates or projection corruption. A caller
should explicitly replay a curated manifest from current Git and receive an exact
revision plus honest per-path outcomes, not an unsupported whole-repository claim.

Success: deterministic revision-pinned replay, bounded memory/admission, no writes
on invalid staged source, recovery after partial failure and unchanged immutable
history on duplicate/repair. Verify actual Git/Postgres/browser composition using
synthetic data and preserve all existing authority and spending boundaries.
