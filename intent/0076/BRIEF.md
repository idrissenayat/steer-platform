# Brief: Verify repeated raw recovery without skipping predecessor authority

A single checkpoint cannot describe repeated interruptions. Extend the candidate
with a bounded ordered chain that preserves original requests and completed
receipts, proves each prior checkpoint and winning reservation, and rechecks
remaining inventory and holds/references at every step.

Do not accept a new sequence number, previous digest or committed flag without
its full evidence. Reject forks, dropped receipts, skipped checkpoints and
erasure receipts inside later-revealed hold intervals. Preserve all copy proof,
deadline and separate human tombstone requirements without per-object approval.

This is synthetic development evidence. Durable storage, provider execution,
acknowledgment-loss handling and terminal consumption remain distinct work.
