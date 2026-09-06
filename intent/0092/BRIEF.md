# Brief

Individually passing migration steps can still omit a batch, transplant starting
data, reuse an action identity or claim a completed chain after interruption.
Backfill also needs to preserve its existing schema rather than invent a new
schema version for every batch.

Add explicit staged profiles and an independently selected ordered chain. Run
every existing full authorization and compatibility check for every attempt,
require exact predecessor/result continuity, and distinguish pending evidence
from complete observed results. Preserve original profiles and frozen records.
