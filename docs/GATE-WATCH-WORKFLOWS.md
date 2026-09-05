# Revision-bound gate-watch foundation

Increment 0041 adds watchGateDecision and a trusted source-observer seam. It
waits for an observation, not approval. No human record is created or changed;
Git/provider records and the required signer policy remain authoritative.

## Explicit composition

A GateTarget has scope (organizationId, repository, itemId), gate (1–3) and
artifactRevision (exact SHA-1 commit). gateWatchId includes every target field
under steer-gate-watch/v1. Changing a gate or revision creates a different watch,
not a mutation of the old execution. Retained duplicate IDs are refused; history
retention is not permanent business idempotency.

createGateWatchWorker accepts an already authorized connection, namespace,
separate compatible task queue, bundle, fixed target and GateObservationPort.
startGateWatch is trusted internal dispatch only, not a public authorized tool.
There is no default gate watcher, live credential use or API runtime activation.
Do not let incompatible reconciliation-only workers poll the gate-watch queue.

The port must freshly authorize and read current source on every observe call,
verify the target gate/revision and return a digest only for its matching decision
record. It must report a changed artifact target independently of an old record.
It cannot trust a cached workflow checkpoint. This increment implements the
port boundary, not the canonical Git/provider verifier or signer/hat rules.

## Checkpoints and outcomes

An observation contains sourceRevision, artifactRevision and decisionDigest
(SHA-256 or null). No signature, subject, token, approval boolean or record body
is accepted. Operational references still need cluster access/retention controls.

The workflow reads one observation per round (1–100), records the checkpoint and
uses a durable timer (1,000–86,400,000 ms) between remaining rounds. Its query
reports progress and the last checkpoint, not current authoritative gate state.
Every later round rereads through the trusted observer; a restored checkpoint
cannot substitute for fresh source authorization or observation.

- superseded: the artifact revision changed, even if a decision digest exists.
- decision-recorded: a digest was observed for the target. This can refer to a
  rejection/send-back or another decision; it is deliberately not approved.
- exhausted: no matching record was observed within the bounded rounds. This
  neither approves nor rejects anything and must be handled explicitly.

Any downstream action must reread the current canonical decision, verify human
identity/hats/signature policy and exact revision, and independently authorize
that action. A completed watch alone must never dispatch a Builder or release.
Source failures stop with a generic error and no activity retry; cancellation
propagates. There is no approval signal handler or automatic resubmission.

The checkpoint is content-addressed observation provenance, not a globally
ordered event offset. Full durable event consumption and reconstruction from the
Git chain remain open under ADR-04. Do not label this the complete event cursor.

## Verification and next work

Actual local Temporal tests recreate SDK workers during a durable wait, resume
the same execution, read a changed synthetic source and replay history without
repeating acknowledged reads. Separate cases verify stale-target supersession,
exhaustion, duplicate/wrong-ID refusal and source failure. This is not an actual
Git signature verifier, a separate gate-worker process crash, cluster restore or
all-in-one identity-to-gate flow. See intent/0041/EVIDENCE.md for exact results.

Next: canonical revision-bound source observation/verification, durable event
cursor contract and public authorized watch composition, followed by business
tools and operating screens. No formal gate or release approval is inferred.
