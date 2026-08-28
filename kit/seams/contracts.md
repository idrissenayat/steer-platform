# Platform seam contracts

The core depends on capabilities, never vendor objects.

## Code host adapter

Reads repository artifacts and revision history; subscribes to authenticated
events; reconciles periodically; records an approval or send-back note against
an exact artifact revision. Implementations must reject stale revisions.

## CI adapter

Returns check cases, Critic findings, plan conformance, coverage, timestamps,
and the revision each element proves.

## Identity adapter

Returns a stable subject, display name, accountability assignments, and domain
specialties through OIDC. The core never accepts a role asserted by the browser.

## Model adapter

Drafts only against a versioned prompt and template. It receives explicit
originator context, may not invent system names, and may not retain session text
after the artifact is committed.
