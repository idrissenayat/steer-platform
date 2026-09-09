# Verified publication and private-draft retention

0270 adds an explicit, uninstalled records action after a candidate save. It does
not change `intent.candidate.save.status`: a read, workflow outcome or execution
checkpoint must not silently apply the publication-retention transition.

## Required composition

`createRecordedCandidatePublicationRecorder` owns the existing encrypted-original
and native Git status reader plus a narrowly scoped lifecycle recorder. A caller
provides only the existing status reference: organization, product, repository,
branch, draft ID/revision and operation ID/input digest. There is no public tool,
HTTP route, automatic startup registration or environment activation switch.

The runtime owner must supply current records authorization and a separate trusted
publication-clock verifier. The latter binds the exact records configuration
(including owner and policy digest), original input, saved bundle reference and
confirmation digest to one stable publication timestamp. Its source and semantics
must be independently adopted under [D1](architecture/DRAFT-RECORDS-AMENDMENT.md).
A schema is not that authority. Git author/committer timestamps, browser values,
current verification time and a successful workflow cannot substitute for it.

Before lifecycle SQL, the recorder reads the original-bound committed receipt,
verifies the clock, then repeats both checks and requires identical results.
Unknown, missing, conflicting, foreign or inaccessible evidence prevents the
records transition. Current authority is rechecked around dependencies. A change
in owner, allowed item scope, receipt or clock withholds acknowledgement.

Only the invocation's fresh verified references enter the existing lifecycle
store. Slow provider reads happen before SQL, not inside its five-second proof
boundary or transaction. One admission is held until timed-out dependencies
actually drain; the total operation is bounded to 90 seconds, authority/clock
calls to five seconds. The proof lifetime starts when verified clock evidence
returns; later authorization latency cannot renew its freshness. Closure prevents
late writes where the commit has not already happened; uncertain commit outcomes
remain unknown.

## Records effect and recovery

The existing forced-RLS lifecycle store records the exact publication operation,
input and timestamp. Its database guards prohibit a pre-creation or future clock,
clock replacement, deadline extension and hold release. The use window is the
earlier existing deadline or publication time plus 60 seconds. This is proposed
policy implementation, not adoption, deletion or evidence of key destruction.

After a lost SQL acknowledgement, reconstruction re-verifies the same original,
receipt, clock and current authority. Repeating that exact record preserves its
timestamp and deadline. A different time conflicts; recovery cannot restart Git,
create another operation/reservation or renew the private draft. Original-store
reads may synchronize only tighter use bounds and sticky holds; encrypted payload
bytes stay unchanged. The return contains references and restriction metadata,
not documents, consent bodies, hold-reference details or signing authority.

Normal original access remains denied once held or expired. This action does not
bypass that boundary to recover a late publication record. Before activation,
governed recovery must address an unavailable original without renewing its clock,
resurrecting keys or granting normal content access. Physical erasure, archives,
backup evidence and actual policy enforcement are separate remaining obligations.

## Verification and limits

See [0270 evidence](../intent/0270/EVIDENCE.md). The joined test extends the same
native-corpus/recorded-SDK/SQL/Temporal original after exact reopen and retained
history verification. It uses actual temporary engines, but its identities,
provider responses, clock attestation and records authorities are synthetic.
No real draft policy is activated; no paid model call or live GitHub write occurs.

0271 adds the [managed identity-runtime boundary](AUTHENTICATED-INTENT-RUNTIME.md).
It validates and owns this internal recorder but does not expose it as a tool,
automatically invoke it, supply a clock or assemble all concrete services.
Next complete the owned factory and independently adopted clock, records,
source/consent/lifecycle and provider bindings. The actual signed-in
[I1–I6 journey](INTENT-JOURNEY-PLAN.md) is not complete from this factory or its tests.
