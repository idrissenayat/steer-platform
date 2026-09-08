# Verified scope-review completion checkpoints

Mark a dispatched semantic-review batch complete only after readback of its exact
immutable encrypted response. Recover that result after restart without reserving
or sending another model call. A completed batch is not semantic clearance.

- [Brief](BRIEF.md)
- [Specification](SPEC.md)
- [Plan](PLAN.md)
- [Acceptance boundary](ACCEPTANCE.md)
- [Evidence](EVIDENCE.md)

This uninstalled composition connects scope observations to durable batch success.
It retains current records/source/key/lifecycle checks and the pinned SDK verifier.
There is no new private-result copy, automatic retry or new spending authority.
Quarantined and failed states cannot be promoted by this normal completion path.

Reference-only Temporal, combined completed-batch consumption, expired observation
recovery, real authority and actual UI/save acceptance remain next. The real records
amendment and first-test model budget remain inactive/unapproved.
