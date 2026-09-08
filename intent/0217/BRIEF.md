# Brief

Preserve the Architect's response and separate Test Agent output so a later role
can consume a verified durable checkpoint without buying another Architect run.
Keep captured originals separate from editable snapshots. Bind exact encrypted
output to the actual server-owned source revision and dispatch-committed SQL step,
and fail closed on stale ownership, unavailable keys, holds or quarantined outcomes.
