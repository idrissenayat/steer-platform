# Brief

Replace the candidate workflow test's invented draft creation/expiry state with
server-owned durable lifecycle metadata. Preserve the original draft identity and
clock across retries, record only explicit discard or independently verified
publication/hold restrictions, and prevent a queued save from reading held data.
This supports future versioned drafts/checkpoints without adopting real persistence.
