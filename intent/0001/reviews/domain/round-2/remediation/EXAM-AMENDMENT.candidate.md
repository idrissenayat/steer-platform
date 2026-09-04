# Gate 2 Exam amendment candidate: round-two closure

Item: `0001-flight-deck-foundation`

Status: **unsigned candidate; not canonical, not a Gate decision, and not build, release, production, deletion, migration, or spending authority**

Reviewed canonical base: commit
`9c7299dd658615cd234e8e03188d607ef1a99fe1`,
`intent/0001/EXAM.md` SHA-256
`91f2744d0675f3c62eb122b2783e3aee147c85981740d0f3f4409b53808e6b10`.
Frozen round-two evidence commit:
`61b6d8577712d1290639e4c7b33acef9342e1c51`.

This is a complete append-only correction candidate for the nine open findings
in the round-two exception brief. If an authorized Exam author incorporates it,
the resulting canonical Exam is a new revision and every prior review becomes
stale. All original clauses not explicitly replaced below remain in force. When
the two texts overlap, the replacements below govern only their named scopes.

## 1. Exact supersession map

| Canonical scope | Operation | Governing replacement |
|---|---|---|
| A1 support-artifact binding | augment | section 2 and the package remediation manifest |
| A3 required evidence | augment | sections 4-9 |
| OR-10 sanitized-real corpus | augment | section 4 |
| OR-17 and A7.1 permissions | replace permission oracle | section 3 and permissions manifest v6 |
| OR-22 and A9.2 manual accessibility | replace reviewer qualification/evidence portion | section 5 |
| A8 retention/lifecycle | replace retention-policy binding and sanitized-real/provider-copy lifecycle | sections 4 and 9 plus retention policy v2 |
| A10.1 provider proof retrieval | augment | section 8 |
| A10.3 migration | replace authorization and destructive-operation portion | section 9 |
| A11.1 spend authorization | replace | section 6 |
| A11.2-A11.4 monetary arithmetic, evidence, forecast | replace monetary arithmetic/rounding and evidence/forecast portion | section 7 |
| A12 Git/code-host loss row and evidence | replace | section 8 |
| A15 technical-release predicate | augment | section 10 |
| A16 Gate 2 prerequisites | replace HR-01/current-package portion | section 11 |

Retention ambiguity is never resolved by a generic “stricter” inference. The
exact Gate 1 PostHog `P90D` rule remains immutable. An unenumerated lifecycle,
conflicting selector, or missing human policy ruling blocks disposition and
release.

## 2. Package binding

The authoritative candidate package manifest is
`intent/0001/reviews/domain/round-2/remediation/remediation-manifest.json`.
It SHA-256-binds the base Exam, both exception-brief forms, all seven round-two
records, and every candidate support artifact. It excludes only itself to avoid
a digest cycle. Any missing, extra-required, mismatched, stale, duplicate, or
unparseable artifact makes this amendment invalid.

Candidate support paths are:

- `RETENTION-AND-RECORDS-POLICY.candidate.md`
- `PERMISSIONS-MANIFEST.candidate.json`
- `PROVIDER-APPROVAL-RECOVERY.candidate.md`
- `CONTROL-ORACLE-FIXTURES.candidate.json`
- `COST-ORACLE-VECTORS.candidate.json`
- `schemas/SPEND-AUTHORIZATION.schema.json`
- `schemas/COST-EVIDENCE.schema.json`
- `schemas/TRUSTED-TESTER-EVIDENCE.schema.json`
- `finding-resolution.json`
- `validate-remediation.mjs`
- `schema-validator.candidate.mjs`
- `preflight-critic-r1.json` (immutable correction input)

## 3. Exhaustive action, path, credential, and role oracle

Replace A7.1's bound oracle with
`PERMISSIONS-MANIFEST.candidate.json`, schema
`steer-permissions-manifest/v6`. Every principal, provider permission,
application action, selector, path class, delegation, credential lifetime, and
required denial is exhaustive and bidirectionally mapped. Unlisted permission or
action is denied. Selectors derive only from verified context; caller assertions
never satisfy them. Missing, extra, duplicated, malformed, wildcard, zero-match,
or multi-match selectors deny before operational credential selection, tool
dispatch, installation-token exchange, provider request, or write.

`github.item.commit` uses anchored closed path classes. It can never address the
canonical Brief, Spec, Architecture, Plan, Exam, signatures, reviews,
authorizations, evidence-governance, policy, schema, CODEOWNERS, or workflow
paths. This denial applies to originator, Builder, platform-agent, worker,
retry/fallback, and compromised-caller requests. A GitHub actor allowlist or CI
success is evidence only and never changes the authorization result.

App-authored Exam changes require the distinct two-step pair:

1. `exam.candidate.author` by an independently assigned current Test Agent,
   bound to exact actor subject, item, target Exam digest, assignment ID/digest,
   exact `intent/0001/EXAM.md` path, review ref, and a verified not-Builder,
   not-originator, not-platform-agent assertion; then
2. `github.exam.candidate.commit` using the same immutable selectors and
   idempotency key.

The downstream App envelope must be byte-equal to the verified upstream actor
subject, live credential ID/digest, signed delegation ID/digest, assignment or
decision ID/digest, target digest, immutable request digest, policy digest,
expiry, idempotency key, and predecessor CAS head. The App installation subject
must equal the delegation recipient. Missing, stale, substituted, Builder-
originated, compromised-caller, same-key/different-request, retry, fallback, or
race-loser envelopes deny through the same decision function before token
exchange. These bindings also apply to decision, spend, lifecycle, and migration
actions; an ID selector without verified bytes is never authorization.

`github.decision.record.commit` matches only a declared Gate 2/Gate 3 or
specialist signature path and requires the complete verified-human decision
envelope and current eligibility evidence from `gate.decide`. A code-host token
or actor allowlist alone can never create approval.

Every denial records the stable reason and permits only authentication
verification-material access. The side-effect ledger must show zero prohibited
credential, installation-token, tool, provider, Git, signature, workflow,
notification, lifecycle, migration, release, or paid effect.

## 4. Sanitized-real provenance, inspection, and lifecycle oracle

Augment OR-10: each of the 20 prompts and every derived baseline, failure shrink,
cache, model/provider copy, Git reference/history/fork, version, backup, export,
and restored copy must pass the exact `sanitized-real` definition in retention
policy v2. The run binds source authority and hash, qualified-owner purpose/use
authorization and allowed derivatives, sanitizer and independent-inspector
revisions, per-prompt results, raw-working-copy disposition receipt, accepted
encrypted corpus object and key, production/fixture destination separation, and
the policy digest.

The oracle fails closed on any prohibited direct identifier, retained
unapproved named entity, source-unique four-token sequence, quasi-identifier
equivalence class `k < 5`, deterministic linkage accuracy above `0.10` or Wilson
95% upper bound above `0.25`, missing/inconclusive result, stale/expired use
authorization, or unverified raw-source disposition. A failed prompt fails the
whole corpus. Source-to-fixture steps are independently reproducible from the
frozen detectors, dictionaries, tokenization, source-pool hashes, seed, and
reports in a network-denied environment.

The repository binds an encrypted corpus object and manifest; one per-version
key is segregated from production. Raw source stays at its named authority and
temporary sanitizer copies are erased within 60 seconds. Plaintext in Git,
history, forks, caches, logs, analytics, or backups fails. Retention policy v2
assigns every corpus record and derivative to a fixed class, trigger, duration,
access/export rule, hold behavior, and verified deletion/tombstone result.

## 5. DHS Trusted Tester Gate 3 oracle

Replace the reviewer-qualification portion of OR-22/A9.2: every new UI requires
the platform pod's own DHS Trusted Tester review at Gate 3. The signed summary
must validate against `schemas/TRUSTED-TESTER-EVIDENCE.schema.json` and bind:
verified human subject and accessibility-specialist hat; current DHS Trusted
Tester credential ID, DHS issuer, verification instant/validity, URI and
evidence hash; current platform-pod assignment path/revision/digest/validity and
provider proof; the exact five versioned families (`desktop-chromium-keyboard`,
`desktop-firefox-keyboard`, `macos-safari-voiceover`,
`windows-firefox-nvda`, and `windows-edge-high-contrast-zoom`) with unique fixed
IDs; the complete A01-A81 inventory with per-checkpoint applicability, outcome,
environment IDs, raw result reference/digest, and aggregate raw digest; exact Exam and implementation
revisions; `newUiChange=true`; Gate 3; decision, timestamp, and provider proof.

A generic accessibility reviewer, unverifiable/expired qualification, non-pod
reviewer, stale assignment, stale revision, missing raw result, or Gate 2 record
cannot satisfy this predicate. This defines future release evidence. It does not
require or fabricate the human review at Gate 2.

## 6. Spend-authorization record and race oracle

Replace A11.1. The only spend grant is a JSON record validating against
`schemas/SPEND-AUTHORIZATION.schema.json` at the exact path class
`intent/0001/authorizations/spend/<YYYY-MM>/<authorization-uuid>.json`. It is
created and signed only through `spend.authorization.create-sign` by a verified
human whose current active hat is `org-budget-owner`, followed by
`github.spend-authorization.commit`. The record binds organization, tenant,
product, pod, environment, purpose, provider/SKU/cost classes, calendar-month
UTC period, USD limits at every scope, effective/expiry instants, exact price
and authorization-policy revisions/digests, signer identity/session/evidence,
non-circular target/predecessor revisions, canonical digest/signature, durable provider proof, and
cumulative lineage, revocation, replacement, and restart terms.

The exact integrity preimage is RFC 8785 JCS over the record with top-level
`recordDigest`, `signature`, and `providerProof` omitted. `recordDigest` is
lowercase-hex SHA-256 of the UTF-8 preimage. Ed25519 signs the 64 lowercase ASCII
digest bytes; `signature.signedDigest` must equal `recordDigest`. Provider proof
is attached after acknowledgement and binds the authorization ID, record digest,
signed digest, provider record ID, and recorded time. `targetRevision` names the
pre-existing artifact/implementation and `predecessorRevision` the prior record
head or null; neither refers to the commit containing this record.

Infrastructure authorization may never exceed the Gate 1 ceiling of exactly
`1,000,000,000,000 nanoUSD` per calendar month; model authorization is excluded
from that ceiling and checked against its separate tree. The ceiling, Gate 1,
any Gate, forecast, test pass, release candidate, or provider budget is never a
grant.

One predecessor-head compare-and-swap serializes creation, amendment,
revocation, and replacement. Concurrent records with the same predecessor yield
one commit and `SPEND_AUTH_CONFLICT` for every loser. Retry reuses one
idempotency key and exact request digest; same key/different bytes is denied.
Supersession is forward-only and cumulative; gaps, forks, rollback to a prior
record, or double counting deny.

Missing, malformed, wrong-tenant, wrong-hat, over-ceiling, stale, expired,
revoked, conflicting, concurrent-loser, superseded, replayed, digest-mismatched,
provider-proof-missing, or lineage-invalid records return
`SPEND_NOT_AUTHORIZED` before credential/provider request and show zero resource
and zero charge in local and provider evidence.

## 7. Cost arithmetic, evidence schemas, and forecast rule

Replace A11.2-A11.4 arithmetic and rounding. USD price, maximum estimate,
reservation, accrual, actual, aggregation, scope consumption, variance, and
invoice comparison use nonnegative checked integer `nanoUSD` (`10^9` per USD)
or arbitrary-precision integer. IEEE-754 cost arithmetic is prohibited. Addition
and multiplication check overflow before state change. All nonzero possible cost
reserves at least one nanoUSD, and every billable line preserves its exact
nanoUSD value through atomic aggregation by idempotency key, cost class, all
five scopes, and UTC month.

No line is rounded to cents. After the provider-defined invoice grouping and
UTC month close, the aggregate is rounded exactly once to cents using
round-half-to-even for presentation/provider comparison. Rounded cents never
feed authorization, reservation, accrual, aggregation, or enforcement.
`COST-ORACLE-VECTORS.candidate.json` is normative for repeated sub-cent,
half-even, mixed-class, concurrency, exact/over-limit, month-boundary,
model-separation, and overflow cases.

Every cost artifact validates under JSON Schema Draft 2020-12 against its exact,
closed, non-overlapping discriminator-const branch and path in
`schemas/COST-EVIDENCE.schema.json`: forecast, authorization (the separate spend
schema), reservation, usage/accrual, invoice, variance, alert, shutdown,
credential revocation, and restart. Completeness is bidirectional: every
provider usage/invoice line has exactly one ledger lineage and every ledger line
resolves to one provider record or explicit provider-not-yet-available state;
the latter blocks release after 24 hours. All records bind authorization,
period, price revision, Exam/implementation revisions, identity/provider IDs,
and canonical digest.

Cost-record integrity uses RFC 8785 JCS over the record with top-level
`recordDigest` and `signature` omitted, lowercase-hex SHA-256, and Ed25519 over
the 64 lowercase ASCII digest bytes. `targetRevision` and
`predecessorRevision` have the same non-circular meaning as section 6.

A forecast passes only when:

1. every frozen assumption has source, unit, low/expected/high with
   `0 <= low <= expected <= high`, current price revision, current usage window,
   and the exact authorization period;
2. infrastructure high case fits every signed infrastructure scope and is at
   most the separate Gate 1 `1,000,000,000,000 nanoUSD` ceiling;
3. model high case fits every signed model scope and is never counted inside or
   used to enlarge the infrastructure ceiling;
4. period rollover creates a new forecast and authorization check; no amount
   crosses month boundaries; and
5. missing/stale inputs, high-case exceedance, or mismatched price/authorization
   digest fails before reservation or credential.

Forecast acceptance is planning evidence only and never spending authority.

## 8. Provider-native authoritative-decision disaster recovery

Replace A12's Git/code-host-loss row with the complete oracle in
`PROVIDER-APPROVAL-RECOVERY.candidate.md`. Gate 1 provider-recorded commercial
approvals remain provider-native authority. Every selected binding inventories
Git objects plus provider reviews, approvals, requested changes, dismissals,
statuses/checks, branch decisions, identity links, policy evaluations, stable
IDs, server timestamps, and provider proofs.

A provider-native decision is authoritative immediately when the primary
provider durably acknowledges it. Independent spool/WORM export is a fail-closed
projection and gate/release condition, never a second authority. Stable-ID
webhook capture, provider fetch, append-only spool fsync, WORM acknowledgement,
minute cursor polling, and hourly inventory reconciliation preserve every
acknowledged decision/proof across every cut. The recovery cut never advances
across a gap. RPO is zero provider-acknowledged decisions and proofs, including
the spool-to-WORM interval; complete primary loss restores and independently
verifies all records within RTO 60 minutes. Stable IDs are
preserved or a signed total, collision-free, one-to-one old/new mapping is
retained. Subject, active hat, sequence, decision, artifact digest/revision,
policy digest, provider timestamp, identity proof, and provider proof remain
canonical-equal.

Missing, stale, partial, corrupt, unavailable, wrong-tenant, wrong-key,
duplicated, reordered, timestamp-regressed, cursor-gapped, collision/many-to-one
mapped, identity/proof-missing, artifact-mismatched, or policy-mismatched
recovery copies fail. Affected gates/releases stay blocked; no decision is
fabricated or repaired from projection. Restored Git commits alone do not pass.

## 9. Lifecycle disposition and schema-migration authorization

Augment A8 and replace A10.3 authorization. Retention policy v2 supplies the
only lifecycle state machine. A current qualified privacy/legal records owner
may pre-sign `records.raw-working-policy-grant.create-sign` for exactly
`RC-CORPUS-RAW-WORKING`, terminal sanitization, frozen sanitizer/inspector and
policy/target digests, allowed temporary-copy providers, complete inventory,
crypto-erase/receipt safeguards, and the 60-second deadline. This permits
deterministic automatic erasure after terminal sanitization without a new
just-in-time per-object decision. Missing, not-yet-valid, expired, revoked,
wrong-class, wrong-target/policy, inventory-changed, held, referenced, or late
grants produce the exact blocked/quarantined state and zero accepted-corpus
effects.

For every other class, `records.disposition.authorize` by a current qualified
privacy/legal records owner binds tenant/item, exact record class,
policy digest, expiry/hold/reference result, copy-inventory digest, and
disposition authorization ID. Only then may `lifecycle.delete-copy`,
`lifecycle.crypto-erase`, and `lifecycle.commit-tombstone` receive one-use
credentials for exact objects/versions/keys/tombstone paths. Missing, stale,
wrong-tenant, inventory-changed, held, ambiguous, race-loser, retry-digest
mismatch, or provider-unknown inputs deny. Two workers produce one provider
request and one tombstone. Partial/unknown deletion quarantines and never claims
success. All lifecycle operations bind the upstream human decision or raw policy
grant, actor, credential, delegation, target, immutable request, policy, expiry,
idempotency, and CAS state through the section 3 decision function.

Schema work uses the distinct `schema-migration-runner`. `migration.expand` and
`migration.backfill` bind tenant, database/schema, exact from/to versions,
reviewed plan and journal digests, implementation revision, batch/checkpoint,
and idempotency. They lack superuser, bypass-RLS, cross-schema, or drop
permission. `migration.contract` additionally requires a separately signed
later cleanup authorization naming exact columns/data, affected-tenant
inventory, backup/PITR evidence, expiry, and rollback consequence. Missing or
stale authorization denies DDL. Interruption before/after every checkpoint,
retry, concurrent old/new readers/writers, app rollback, same-key/different-
request, two-runner race, wrong tenant, and provider-unknown outcomes run through
that same decision function and must yield one journaled result or a safe non-
result, never duplicate or cross-tenant loss.

## 10. Technical-release predicate

`technical-release-candidate` additionally requires all candidate package
schemas and deterministic fixtures to pass at the exact implementation and Exam
revisions; current sanitized-real provenance/use/lifecycle evidence; the future
DHS Trusted Tester Gate 3 evidence for new UI; valid spend authorization only if
a paid path is exercised; complete cost forecast/ledger/reconciliation;
provider-native recovery rehearsal; and every lifecycle/migration permission and
race row. Missing or inconclusive evidence is failure. No candidate artifact or
test run performs the future human review, policy ruling, migration, deletion,
deployment, or spend.

## 11. Gate 2 eligibility and human rulings

The historical accepted HR-01 remains untouched but binds only retention policy
v1 SHA-256 `271d4fa1ee2682f06e504e615cc9e8588ea34ff3ff7d5e2c27f245f80509c96c`.
Because policy v2 changes record classes and disposition, a new qualified
privacy/legal records-owner ruling over its exact final path and digest is
required. The ruling must bind signer identity/qualification/active authority,
decision, server timestamp, provider proof, target Exam revision, and conditions.
An agent cannot create or infer it.

After authorized canonical incorporation, all seven domains must independently
review the new exact Exam revision, a new consolidated exception brief must have
zero open findings, every triggered human disposition must be current, actor-
bound Exam CI must pass the actual author/diff, and a fresh-context final Critic
must report zero findings before a human Tech Lead may decide Gate 2.

This candidate neither signs Gate 2 nor authorizes a Builder, canonical edit,
commit, push, release, production use, paid service, migration, deletion, or
spending.

## 12. R2R2 executable correction contract

The protected-action oracle MUST consume a schema-validated immutable serialized request and retrieved signed credential, delegation, and upstream envelopes. It MUST select the manifest action, compare every selector as UTF-8 bytes, verify signer, role, currentness, exact action-specific identifiers and strict timestamps, and deny malformed, substituted, stale, retry, fallback, or CAS-race inputs before credential or provider effects.

Spend, forecast, and cost decisions MUST consume actual parsed monetary records only after one semantic validator recomputes their RFC 8785 preimages, SHA-256 digests, Ed25519 signatures, provider-proof preimages and signatures, and validates target and predecessor revisions, temporal and status transitions, lineage, scenarios, period, price, scope, and cross-record references. No boolean summary may substitute for a validated record.

Trusted Tester evidence MUST be a signed provider-bound human summary. Its signed preimage binds the exact Exam and implementation revisions, checkpoint-model digest, qualification, assignment, review and signing times, all 81 checkpoint dispositions, and the complete retrieved raw bundle bytes. `pass` is valid if and only if every applicable required checkpoint passes; applicability and outcome MUST be coherent.

The lifecycle oracle MUST execute every record class at the before, exact, and after boundary under hold, reference, unknown, restored-copy, and read-race precedence. It consumes signed raw grants or disposition authorizations plus exact inventories, receipts, and tombstones; exact 60-second missing receipt, partial or unknown provider effect, idempotency drift, and CAS loss all fail closed with a typed zero-effect ledger.

The recovery oracle MUST execute all eight named loss cuts over structured provider journal, webhook, fetch, spool, WORM, cursor, Git-object, mapping, and restored-record fixtures. It compares canonical bytes and inventories, proves gapless cursors and one-to-one mapping, measures numeric RTO, retries each request with identical identity, and gives any failed rehearsal zero gate, release, or destructive effect.

## R3 authoritative-state correction contract

The protected-action oracle MUST consume a signed, current authoritative CAS
head, a signed current idempotency/replay ledger snapshot, and the signed result
of one atomic head/key reservation. A caller-coherent request plus upstream
envelope is insufficient. Only the atomic winner may reach credential or
provider effects; the loser, stale snapshot, same-key/different-bytes request,
and replay all have zero pre-authorization effects. A same-key/same-bytes replay
is an explicit `REPLAY_NOOP`.

Every monetary record timestamp MUST fall within the fully revalidated signed
authorization's effective/expiry interval. Provider proof MUST be
cryptographically valid, at or after the sealed record time, and inside the
authorization and cost period. Each reference follows the same signed semantic
validation path and matches organization, tenant, product, pod, authorization,
period, price, revision, and allowed transition. Aggregation uses checked BigInt
nanoUSD with explicit safe-integer bounds and overflow rejection.

Each Trusted Tester JSONL line has exactly checkpoint ID, environment ID,
applicability, and observed outcome. Its digest, identity, applicability, and
outcome MUST equal the summary row; the overall decision is derived from those
raw rows. The provider proof is itself signed and binds provider identity,
provider record ID, review ID, summary digest, and recorded time. Any
raw-summary contradiction fails.

Lifecycle expiry MUST be derived from the signed trigger history and the
hash-bound policy table covering all 16 classes, including each class's exact trigger,
calendar/fixed duration, parent cap, and closed derived-record inventory. A
supplied boundary disagreement fails. Disposition additionally requires a
fresh signed complete-copy inventory, receipt at or after the boundary,
tombstone at or after the receipt, and successful idempotency/CAS reservation
through the protected-action decision path.

Recovery fixtures MUST materialize a distinct reachable source state at each of
the eight cuts. They recover only from sources durable at that cut. The oracle
derives pre/post inventories from canonical provider bytes and independently
restored bytes, binds the cursor to each record cursor, and proves exact decision
bytes, Git artifact bytes, collision-free total mapping, RTO, retry identity,
and zero failed-rehearsal effects.

## R4 exhaustive-policy and executed-matrix correction contract

The protected-action decision MUST obtain the selected action, required
upstream action, executing principal, upstream principal, and required actor
role from the same exhaustive permissions manifest. It MUST reject an absent,
unlisted, or duplicated action before effects. Manifest exact-path rules and
every anchored allowed path-class expression are authoritative: an exact-path
mismatch, zero class matches, or multiple class matches denies before credential
exchange or provider request. A signed downstream credential, signed upstream
credential, independently issued assignment or decision record, and signed
delegation chain MUST bind the actor, role, authority record, immutable request,
selectors, provider permission, and recipient. The manifest exact-path rules are
therefore enforced directly. Coherent wrong-path requests for
normal item, Exam, decision, spend, and tombstone commits, and missing, unlisted,
or wrong-role migration plan/cleanup authorizations, MUST have typed zero
effects.

Every declared fixture ID and cost-vector ID, and every declared coverage kind,
MUST execute through the shared schema or semantic oracle. The validator MUST
prove that every declared fixture ID was consumed before reporting success. It MUST
compare exact state/decision, first error, and typed effects, and MUST fail on an
unexecuted or duplicate ID/kind. This includes all authorization byte mutations,
spend rows, sanitized-real direct-identifier/NER/four-token/k/linkage-Wilson and
provenance/use/inspection/derivative/baseline/shrink/raw-receipt/destination
controls, lifecycle cases/cross-product/specials, all eight recovery cuts, all
nineteen recovery corruptions, recovery cases, and all cost/forecast vectors.

## R5 complete resource, delegation, lifetime, and authority-scope correction

For every protected action, the immutable request selector set is the exact
union of the downstream action selectors, the required upstream action
selectors, and both actions' provider-resource selectors. Upstream credential
ID/digest and upstream provider use distinct names in the downstream request;
all other upstream selectors retain their names. No authority selector may be
missing or skipped. Item, Exam revision/target, product, pod, active hat,
policy, tenant, organization/repository, exact path/ref, provider and
installation are byte-equal across the request, signed upstream envelope,
independent authority record, credential/delegation chain, and manifest rule.

Provider resources use closed `type:value` syntax. Exact resources, anchored
path classes, and path prefixes are evaluated against immutable selectors and
must yield exactly one match per selector. Unknown, extra, duplicate,
malformed, wildcard, zero-match, or multiple-match resource policies deny
before credential access, token exchange, or provider request.

Each signed credential has an exact principal and subject, strict `issuedAt`,
`expiresAt`, and `lastUsedAt`, and a lifetime no greater than that principal's
`maxLifetimeSeconds`; idle and one-use rules are enforced when declared. The
delegation issuer principal must enumerate the recipient principal in
`mayDelegateTo`, issuer and recipient subjects/principals/credential digests
must match, and the delegation window must be contained in both credentials.
Positive fixtures use 300-second credentials. Coherently signed attacker-repo,
24-hour credential, forbidden-edge, item/Exam-revision/product/pod/active-hat
substitution, and resource wildcard/zero/multiple/unknown cases all deny with
the complete typed zero-effect ledger.

## Publication boundary and next preflight

## R6 exact-copy inventory binding correction

R6 exact-copy inventory binding requires every `lifecycle.delete-copy`
immutable request to name tenant, retention class, target digest, policy digest,
copy-inventory digest, provider, copy ID, copy kind, object key, version ID, and
key ID. Exactly one present row in the current signed inventory MUST match the
provider/copy/object/version/key resource. The signed disposition authorization
MUST carry that same exact copy tuple; an independently signed provider-resource
snapshot and the provider-control-plane CAS snapshot MUST each bind the same
request selectors before credential or provider effect.

Disposition receipts and tombstones MUST map every inventory copy one-to-one by
the full tuple, immutable request digest, idempotency key, unique provider receipt
digest, and verified effect. Zero or multiple inventory matches, stale or restored
inventory races, wrong object/version/provider/tenant/class/target/policy,
wildcard or resource substitution, CAS substitution, and retry drift MUST deny
with the complete typed zero-effect ledger. The direct coherently resealed
`objects/attacker` counterexample is mandatory and MUST return
`LIFECYCLE_COPY_ZERO_MATCH`.

## R7 per-copy and per-key bijection correction

R7 per-copy and per-key bijection replaces the fixed two-action lifecycle
assumption. The current signed inventory MUST contain a canonical ordered array
of present tuples comprising authority ID, copy ID, copy kind, provider, object
key, version ID, and key ID, plus the SHA-256 digest of the RFC 8785 JCS tuple
array. Authority IDs MUST be unique. Every present tuple MUST have exactly one
current signed disposition authorization, or exactly one current signed raw
policy-grant authority when policy explicitly permits crypto-erasure. Raw grants
are per key/copy, not blanket grants.

Every present tuple MUST also have exactly one unique immutable protected
provider request before the single final tombstone request. Tenant, record
class, target, policy, inventory digest, tuple digest, authority ID and digest,
copy ID, copy kind, provider, object key, version ID, and key ID MUST compare
byte-for-byte across the signed inventory, authority/grant, request, independent
provider-resource snapshot, provider CAS snapshot, receipt row, and tombstone
row wherever those fields occur. For crypto-erasure, the requested key ID MUST
equal the inventoried and granted key ID. A request digest or idempotency key
MUST NOT satisfy two tuples, and missing, duplicate, reused, or extra authorities
or requests MUST deny before any effect.

The signed receipt and tombstone MUST each bind the same canonical ordered tuple
array and its digest, the ordered authority-ID array and digest, and the ordered
immutable-request-digest array and digest. Rows MUST remain in that order and
bind the corresponding authority, request, idempotency key, unique provider
receipt, and exact disposition. The executable matrix MUST include passing
two-copy and raw-multikey cases and zero-effect missing, duplicate, reused,
extra, tuple-mismatch, raw-key-substitution, retry, and restored-race negatives.

## R8 provider receipt and idempotent replay correction

Lifecycle completion MUST consume one immutable provider-signed receipt bytes
object for every canonical ordered present tuple. The strict provider receipt
schema binds a stable provider receipt ID, provider request ID, provider
transaction ID, provider identity and provider-bound Ed25519 proof, terminal
status and exact effect, tenant, record class, policy and target digests,
inventory and tuple digests, authority ID and digest, copy, kind, object,
version, key, immutable request digest, idempotency key, request time, and
provider time. Request time MUST precede provider time, which MUST precede the
aggregate disposition receipt. The lifecycle oracle derives the digest and
aggregate row from each verified provider-signed receipt bytes object and
requires exact ordered one-to-one equality with the signed aggregate receipt.
Missing, duplicate, fabricated, substituted, stale, partial, failed, unknown,
in-progress, wrong-tenant, wrong-resource, wrong-effect, or replayed evidence
MUST block with typed zero effects.

An exact same-bytes REPLAY_NOOP is a lifecycle reconciliation result, not a
failure. It may converge to `deleted-tombstoned` only when the authoritative
ledger proves that exact idempotency key and immutable request digest were
committed, every corresponding provider receipt is independently verified,
the aggregate receipt and tombstone match, and the final commit evidence is
complete and temporally coherent. A fully committed replay produces no second
provider or lifecycle effect. Mixed fresh `ALLOW` and prior `REPLAY_NOOP`
recovery after each provider-copy, aggregate-receipt, and tombstone-commit crash
cut MUST converge without repeating prior destructive effects. Same key with
different bytes, missing evidence, a conflicting tombstone, in-progress
timeout, duplicate effect, stale snapshot, or lost reservation/race MUST deny
deterministically with typed zero effects. The executable matrix includes each
positive and negative case.

## R9 independent provider trust-domain correction

Provider receipt verification MUST use the immutable
`PROVIDER-KEY-REGISTRY.candidate.json` registry whose RFC 8785 digest is
hash-bound by the candidate permissions manifest. Each inventory tuple selects
an exact `providerBindingId` through the manifest's independent provider
onboarding mapping. Receipt-controlled provider, binding, key ID, account, or
tenant claims MUST NOT select a trust anchor. The registry stores distinct
provider public keys with explicit algorithms, inclusive `notBefore`, exclusive
`notAfter`, and optional revocation time, plus exact provider, provider-account,
tenant, proof-type, and proof-issuer scope. The registry contains no private
key. Provider fixture private keys are test-only, distinct from the ordinary
local record-signing key, and unavailable to `sealRecord`.

The registry digest is part of the signed lifecycle event, provider request,
provider receipt, aggregate disposition receipt, and tombstone. The selected
provider binding is part of the signed copy inventory tuple, authority,
provider request, provider receipt, aggregate row, and tombstone row. At the
provider timestamp, verification selects the sole current, non-revoked key
from that independently selected binding, requires its registered algorithm
and key ID, and verifies the receipt preimage with only its registered public
key. A zero-key or multiple-key interval fails closed.

The executable matrix MUST pass distinct provider-A and provider-B receipts and
the exact old-to-new rotation boundary. It MUST deny with the complete typed
zero-effect ledger for a receipt made by the local record signer, relabeled
provider/key/binding metadata, a provider-A key used for provider B, unknown,
revoked, expired, or not-yet-valid keys, wrong algorithm, issuer, account, or
tenant, registry-digest mismatch, tampered preimage or proof, and duplicate
provider transaction. `R9-LIFECYCLE-LOCAL-SIGNER-FORGERY-ZERO-EFFECT` is the
mandatory counterexample and MUST return `PROVIDER_RECEIPT_PROOF_INVALID` with
`effects.lifecycle = 0`.

This correction pass deliberately does not edit the canonical Exam. Once this
candidate is stable, an authorized independent Exam author using the configured
GitHub App protected authoring path is the only actor permitted to incorporate
these contracts into a new canonical Exam revision. The next fresh-context
preflight Critic evaluates whether this unsigned candidate is technically safe
and complete for that incorporation; it MUST NOT demand that the candidate
already be canonical as a condition of pre-incorporation adequacy. Only after a
safe/complete advisory may the authorized author incorporate, freeze the new
revision and package together, and trigger exact-revision domain review. This
paragraph does not authorize or perform publication, commit, push, signature,
Gate transition, build, release, deletion, migration, provider access, or spend.
