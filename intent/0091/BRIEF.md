# Brief

The single-step migration verifier checks exact transformations and signed
evidence, but supportedReaders/supportedWriters are only declarations. A contract
can correctly perform its approved drop while losing logical data if backfill
was incomplete. A reader can also observe a stale mirrored value.

Compose complete signed migration verification with executable, pinned old/new
client behavior over both supplied states. Exercise all bounded interleavings,
competing snapshots, retry and replay, preserving other rows and unrelated cells.
Keep model compatibility distinct from live application/database compatibility.
