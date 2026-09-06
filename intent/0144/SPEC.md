# Spec

## Native contract

Support the two retained `steer-critic-review/v1`, Gate-2-only HOLD layouts:
initial `findings` with rank and follow-up `originalFindingStatus` plus `newFindings`.
Use a closed union so incompatible fields cannot be mixed or silently stripped.
Preserve reviewer, validation, GitHub evidence claims, recommendation text, all
findings, resolved statuses and original cited prose. Those are claims, not new
executions or live observations.

Recompute every unresolved total and severity counter from the complete entries.
Reject duplicate IDs across old/new entries, missing required resolution for open
follow-ups, unknown statuses, mismatched counters and undeclared authority fields.
Rankless resolved follow-ups do not invent their former severity. This checks
within-record consistency; proving history completeness and valid prior closures
still needs independently selected prior records and reviewer provenance.

The supported disposition is exactly hold-send-back with pass false. Even a HOLD
with zero open entries remains failed. Do not invent a PASS spelling or infer a
passing profile from historical test success. A future canonical passing format
needs a separately specified and reviewed source contract. Remediation preflight
formats, including R5, are not aliases for these canonical Critic records.

Bind the exact SHA-256, record item, reviewed artifact revision, provider and task
to explicit startup expectations. Compare review/evaluation chronology in exact UTC
nanoseconds. Native records lack an organization claim; tenancy is supplied by the
actual scoped Git collector, never synthesized inside the native record.

Preserve fresh-context declarations, but derive false if the record admits inherited
conversation or prior authority, or if its task equals the explicitly selected
Builder task. This is conservative claim normalization, not proof of isolation or
identity. Raw evidence citations are bounded opaque prose, not executable URLs,
trusted digests or paths that can authorize additional reads.

## Collection

An explicitly selected native Critic reference adds format, reviewerProvider,
reviewerTask and builderTask to its path/digest. Missing or unsupported selections
and non-Gate-2 use reject before source access. Read original bytes from the same
current head as the gate policy chain, verifying scoped coordinates, UTF-8,
SHA-256 and Git blob ID. Review time must not follow any canonical gate signature.
Use a 512-KiB native record cap and existing 8-MiB collection budget. Normalized
development records retain their existing 64-KiB contract.

Feed the actual normalized HOLD into the existing policy evaluator and retain both
the immutable native observation and original snapshot. Non-native entries expose
nativeCritic null. Existing whole-call deadline, actor, source-head, minimum signer
validity, overlap refusal and draining shutdown remain unchanged.

## Non-authority output

Results require independent reviewer authenticity, evidence, finding-history and
source verification. The collector still requires governed selection and live
revalidation. gateVerified and writeAuthorized stay false. No original record,
signature, protected Exam, runtime binding or provider state changes.

