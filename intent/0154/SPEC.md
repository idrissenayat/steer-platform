# Spec

Add a held writer factory that composes the existing GitHub writer/membership
factory with the actual gate-policy collector. Validate the complete two-gate
configuration at startup and bind its Gate 2 target to the writer's organization,
repository, platform revision and exact decision digest. Invalid pins must fail
before provider or observer I/O. No request installs gate configuration or trust.

Each managed invocation owns its policy collector and read-only Git reader. The
human's current membership is checked by the existing writer layer; the separate
observer must satisfy the existing scoped, hatless `gate.observe` requirements.
Collect policy at the exact expected source head, using actual source bytes,
signature verification, prerequisites, reviews and any explicitly configured history
checks. Preserve existing source integrity, time bounds and final authorization.

After a successful collection, retain only an immutable internal diagnostic with
the source/platform revisions, Gate 2 digest, policy outcome and missing requirements:
policy blockage when applicable, governed selection, review provenance and complete
action-time authority. Do not expose source bodies, identities, keys or tokens.
This diagnostic is not a public readiness endpoint, fresh authorization lease or
proof of approval; it must never satisfy the Brief write-authority contract.

The present source collectors explicitly require additional governance and provenance
verification. Therefore every write-authority attempt remains denied even when the
policy evaluator reports `policy-satisfied`. No injected verifier can override this
held factory. Direct `compareAndCreate` also denies before provider I/O, including
when supplied a fabricated proof. Status reads retain existing authoritative marker
semantics: absence is not a saved receipt and is not permission to retry a write.

Clear diagnostics before later operations and on closure. Closing is idempotent,
stops the underlying writer, prevents new source I/O and drains owned policy work.
Keep this factory out of the live runtime until governed configuration and required
approvals exist. Do not infer Gate 2, write permissions, deployment or spending.
