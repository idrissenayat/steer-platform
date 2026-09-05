# Specification

1. A gate target contains exactly organization/repository/item scope, gate 1–3
   and a 40-character artifact revision. The versioned workflow ID includes all
   fields. Plans add only existing bounded rounds and intervalMs.
2. The fixed activity binding rejects every foreign target before observer access
   and refuses actual overlap. A trusted observer must freshly authorize and read
   the current source, bind any decision digest to the exact target, and report
   a changed current artifact revision. No prior workflow checkpoint is supplied
   to the observer as evidence or authority.
3. Observations contain exactly source commit, current artifact revision and a
   nullable SHA-256 decision-record digest. Reject bodies, signatures, approval
   booleans, private payloads and malformed references; sanitize observer failures.
4. Durable polling stores each checkpoint in history and rereads source on later
   rounds. Different artifact revision yields superseded before considering any
   digest. A matching digest yields decision-recorded, not approved. Missing
   records yield a timer or bounded exhausted result. Neither exhaustion nor
   failure implies denial, approval or absence of a record beyond the observation.
5. Observe activity retries remain disabled. Cancellation propagates. Wrong
   workflow IDs deny before activity; retained duplicate starts fail. No signal
   handler, signer, release/build action or public gate tool is introduced.
6. Workers use a separate explicitly configured compatible task queue. Source
   authority is trusted runtime composition, not workflow arguments. Existing
   reconciliation workflows remain replay-compatible under regression tests.
7. Verify checkpoint/restart/replay behavior against actual local Temporal, with
   explicit synthetic-observer boundaries. A checkpoint is not a globally ordered
   durable event cursor and does not complete ADR-04 consumption/rebuild requirements.

Non-goals: canonical Git/provider decision verification, signer/hat policy,
public scheduling/ownership for gate watches, event offsets, service reconstruction
from Git, process/server crash coverage for this new workflow, gates or deployment.
