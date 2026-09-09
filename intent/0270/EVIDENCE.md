# Development evidence — 2026-09-09

Base: `dce685c069a4aa3176dfd364d91108730901b366`.

## Implemented

An explicit uninstalled recorder connects the existing original-bound saved Git
receipt to `recordPublication` in the draft lifecycle. Separate current records
authority and a stable trusted clock are mandatory. Two receipt/clock observations
must match the exact configuration, original and saved reference before SQL.
Status remains read-only; no default registration, public command or live grant
is added. Owned composition closes both the recorder and original/status reader.

The joined native-corpus/recorded-SDK/SQL/Temporal test now defers publication until
after exact reopen and retained history checks. It exercises lost publication SQL
acknowledgement, reconstruction, immutable time/deadline, encrypted payload fidelity,
monotone original restrictions, unchanged operation/budget counts and hold denial.
All clock, records and provider authorities remain explicitly synthetic.

## Verification

All eleven focused recorder unit tests pass. They cover missing authority, injected
timestamps/receipts, original/configuration/reference/confirmation mismatches,
unknown/conflicting/missing saves, scope changes, sanitized current-grant loss,
timeout admission retention, proof expiry and destruction of late pool connections.

The first `--candidate-journey` run passed its joined check and idempotent migration
verification. The same confirmed original reached one fixed Temporal activity and
one native Git save, original-bound receipt recovery, exact older-commit HTTP
reopen and retained SDK history after a human edit. The new final records phase
passed independent records denial, a lost SQL commit acknowledgement, reconstruction
with the exact stable clock, rejection of a later clock without deadline renewal,
unchanged encrypted payload, tightened original-use bounds and sticky hold denial.
Operation/original/budget counts and the later Git head remained unchanged.
Only this run's owned synthetic SQL/Temporal/Git fixtures were cleaned up. This
focused selection is not the full SQL suite or signed-in/browser acceptance.

The broad suite passes all 1,305 regressions. Prototype/eight-package type checks
and the optimized Next 16.3.4 production build pass. Final inspection tightened
proof freshness: authorization latency now consumes the five-second proof lifetime
instead of advancing its start. Both the post-clock and lifecycle-authorization
aging cases pass in the final eleven-test recheck; data/API/worker types pass again.
The final `--candidate-journey` recheck also passes its joined check plus idempotent
migration verification with that freshness change. It repeats the full recorded
package/save/reopen and publication-recovery phase above. Its owned synthetic
containers and tmpfs data were cleaned up; no real records migration occurred.

Kit validation passes all 95 required artifacts, and the workflow token-scope audit
passes. All 324 local Markdown links in the ten changed documents resolve, and
`git diff --check` passes. The protected Architecture, canonical Exam and accepted
retention-policy hashes remain unchanged. User-owned roadmap/outputs are excluded.

## Boundaries and next work

This is not real-user UI acceptance, D1 adoption, an implemented trusted clock
authority, physical erasure/backup evidence, a model quality evaluation or a live
GitHub save. The factory is uninstalled. A held/expired original cannot be bypassed
for late publication recovery. Actual clock semantics/provenance and constrained
late recovery still require governed composition before activation.

Next complete startup/service ownership and current records/source/consent/lifecycle
bindings. Records adoption, the proposed model budget and provider/write authority
remain unresolved. No paid model call, real draft migration, provider grant,
credential change, gate, deletion, deployment or release occurs in this increment.
