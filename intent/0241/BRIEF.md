# Brief

The actual application needs a normal authorized query for recorded duplicate and
partial-overlap review progress and findings. It must not read private persistence
directly, trust workflow status as verified findings, or turn an unavailable service
into an empty review that looks like a new intent.

Expose the combined reader through an explicit human tool grant with exact scope,
current identity checks, a server-pinned profile and mandatory SDK verification.
Validate the portable response state, batch/corpus accounting and digest before
releasing findings. Keep expired, superseded, unresolved and incomplete outcomes
distinct. This work does not activate live persistence or complete the frontend.
