# 0296 — Consolidate identity checks around historical source-policy queries

Historical scope validation repeatedly wraps the same metadata-only source grant
query in caller checks. Remove redundant leading checks only where a private
constructor proves the exact source policy and caller identity. Keep fresh caller
verification after the policy and before data access or continuation.

Preserve initial authentication, both full scope-history reads, every independent
source grant, keys/lifecycle/hold checks, cancellation and actual pending-work
admission. Ordinary or unknown callbacks retain their full bracket. No permission
cache, new public input, activation, model spend or runtime GitHub authority.

This is partial C22 work; measure the full authenticated synthetic save journey
and do not count a request reduction as completed performance or live acceptance.
