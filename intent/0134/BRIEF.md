# Brief

The 0132 writer must belong to one authenticated invocation, not a shared global
service carrying another request's credentials. Prepare transport/service plumbing
that creates it lazily, supplies the actual verified session callback and closes
owned instances after work, including failures and uncertain outcomes.

Keep the common registry's authorization and schemas authoritative for every
transport. Preserve CSRF, mixed-cookie/bearer denial and current Git-backed grants.
This is closed integration work while full authority verification remains unfinished,
not a change to gate requirements, provider scope or the production bootstrap.
