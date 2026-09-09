# Historical generation input verification

Increment 0256 recovers the exact retained input to a generation operation after
its scope assessment expires or the human edits the draft. This is a server-side
lineage primitive, not a public UI response, new assessment or execution grant.

## What is verified

`createDevelopmentOriginalStore.readHistorical` accepts only the existing exact
`operationId` and `inputDigest`. It restores the authenticated encrypted original,
including the human's source revision, reviewed repository evidence, explicit
direction, captured assessment and original nonsecret role profiles. It verifies
the original input digest and exact retained draft content before release.

For an assessed generation, the separate scope-history reader must match the
original owner, organization, product, repository, review reference, assessed
draft revision and digests, source commit, inventory, source snapshot and combined
findings. Expiry and a newer draft do not change those historical inputs. The
existing [scope-history reader](SCOPE-ASSESSMENT-HISTORY.md) verifies retained
recorded SDK exchanges and succeeded batch digests under current permission.

A complete empty corpus needs no scope model history. An older original without
an assessment remains explicitly without one; the reader never invents missing
review evidence. Neither case gains current duplicate clearance from recovery.

## Authority and lifecycle

Historical input access requires the distinct present `authorizeHistoricalRead`
callback. The ordinary input permission and old execution authorization are not
substitutes. Current original-source permission, draft ownership and records-policy
binding, historical key access, exact source revision and lifecycle hold/use limits
remain mandatory and are rechecked before release. Nonvoid authorization responses
are not approval. Errors remain sanitized.

The existing bounded dependency and single-admission controls remain in effect;
timed-out dependencies must drain before another request can enter. Closure denies
late release. Reading creates no draft revision, operation, checkpoint, reservation
or provider call and cannot extend execution or retention.

The returned original is private server data: it contains source content and
configured prompts. Do not serialize it wholesale through HTTP/MCP or into browser
state. A future human-facing lineage view needs its own bounded, explicitly
authorized projection and invalidation rules.

## What remains separate

Ordinary `read` and `put`, preparation, start and worker reconstruction still use
current-only scope validation. They have not been switched to history. The result
is labeled historical and carries false execution/retry/gate flags; it does not
contain a dispatch or checkpoint capability.

Input recovery does not prove that a role generated any output, that a later human
edit was agent-authored, or that an Exam is accepted. Next, compose historical role
request/response verification and output lineage, then expose safe human comparison
and bind that lineage into immutable save preparation/confirmation/start. All-revision
run discovery and the real signed-in save/reopen acceptance remain outstanding.

No runtime binding, migration or dependency is added. D1 is still unsigned/inactive;
current records/provider authority and separately approved model spending remain
prerequisites. Synthetic SQL/SDK tests are not live human/provider acceptance.

See [0256 evidence](../intent/0256/EVIDENCE.md), [the controlling plan](INTENT-JOURNEY-PLAN.md)
and [the workflow contract](architecture/WORKFLOW-CONTRACT.md).
