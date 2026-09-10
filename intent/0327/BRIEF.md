# 0327 — Owned draft reads during source review

Replace repeated complete draft restoration within one read-only source review
with one owned exact snapshot and full final verification. Preserve every current
permission, key, lifecycle, source-revision and encrypted-row check before the
review can return. Do not share a phase across requests, admission or saving.

Also repair lifecycle fault-injection fixtures discovered during verification:
a fixture failure must never count as proof of late hold/expiry enforcement.
This advances C22 and test integrity, not live-model or signed-in UI acceptance.
