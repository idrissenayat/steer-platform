# Git-backed gate-record observation

Increment 0042 supplies actual Git provenance to the 0041 gate-watch seam.
It is a read-only record observer, not a signer or canonical signature-policy
verifier. Finding a structurally matching record never authorizes an action.

## Fixed source and fresh authority

createGitGateObserver accepts a RepositoryReader, fixed target scope/gate/revision,
1–10 unique governed artifactPaths, recordPath and recordItem. The record path
must differ from governed artifact paths. The scope must match the reader's
organization and numeric repository identity. The canonical item string is
explicit because existing signature item names differ from workflow item paths.

An authenticate supplier must freshly verify the service identity. The observer
requires an unexpired same-org agent, no human hats and explicit gate.observe,
before source reads and again before returning. A changed subject or original
expiry denies. There is no stale identity/projection/workflow fallback.

Each observation pins a current head and compares every governed artifact's
verified Git blob at target and current commits. Snapshot scope/path/revision,
SHA-256 and blob SHA-1 must agree; bytes are bounded to 512 KiB per artifact.
Changed content yields supersession with the current head and no record digest.
Missing/removed artifacts fail closed rather than adopting an old decision.

For unchanged artifacts, a bounded inventory at that exact head distinguishes
an absent record from an unavailable source. The exact configured record path,
its inventory blob and verified snapshot must match. A final head comparison
rejects movement during observation; failure is generic and not retried.

## Record matching is not approval verification

The adapter reads the existing steer-gate-signature/v1 envelope. It checks
organization, product-home URL, item, gate, revision, configured artifact set
and basic signature field structure. An old artifact revision yields no digest.
A matching record yields only its SHA-256 reference, regardless of whether its
decision text is approved, send-back or another disposition. Bodies, subjects
and signature details never enter the Temporal observation receipt.

This does NOT validate provider/session proof, a qualified authorized human,
active hats, distinct signers, sequence/decision policy, record revocation,
protected authorship or branch enforcement. Canonical policy verification must
perform those checks against fresh source before any downstream action. The
component lock deliberately leaves canonicalGateSourceVerifierVerified false.

Branch ancestry, anti-rollback, append-only event order and a globally ordered
resume cursor remain separate requirements. Current-head provenance is not a
complete event cursor or proof that a historical decision is still actionable.

## Worker composition and lifecycle

createWorkerGateObservationRuntime binds the observer to the exact gate activity
through the permitted worker composition root. No SQL, provider discovery, new
credential loader, public tool or default runtime is introduced. The caller
owns the reader and authentication infrastructure. Shutdown closes admission,
waits for actual pending observation and does not pretend to cancel provider I/O.
The observer does not close a shared reader it does not own.

## Evidence and next work

Native tests cover format/provenance, stale/absent/mismatched source, corruption,
head movement, fresh revocation, overlap and drain. Actual isolated Git/Temporal
tests start without a record, stop/recreate the worker/runtime, commit a
synthetic send-back record and observe its exact digest. A later artifact change
invalidates that target. A separate Git-committed observer revocation denies a
later round after restart. No real signature or GitHub credentials are involved.
See intent/0042/EVIDENCE.md for final command results.

Next: canonical signer and decision-policy verification, then complete event
cursors/public gate-watch composition and business tools/screens. The five R5
findings and live provider/deployment/release/spending restrictions remain.
