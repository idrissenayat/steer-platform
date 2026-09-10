# 0306 — Canonical record contents and owned key access

Status: focused, native, type and control checks pass. Not a factory switch or C22 pass.

The internal [decoder](../../packages/data/src/records-content-codecs.ts) shares
the existing stores' actual canonical metadata, AAD, digest and payload codecs.
It reconstructs exact draft/scope/development/candidate contents and checks stored
hashes and retained-source bindings. PostgreSQL JSONB may reorder object keys;
structural equality is order-insensitive, while stored cryptographic hashes retain
their original canonical formats. No encryption format or store behavior changed.

The internal [content owner](../../packages/data/src/records-content-reader.ts)
requires independent key policies for all seven encrypted groups. All row grants
precede the first key lookup. Material is shared only for the same explicit provider
object, draft and key ID inside one read. The same ID on different providers may
resolve to different keys. Owned 32-byte copies are checked again and wiped;
provider-owned buffers are never wiped or returned to the consumer.

The trusted read-only consumer must await key and complete records/lifecycle
recheck before final source verification. Cancelled lookups and forgotten pending
rechecks remain owned until they settle. Decoded results explicitly retain false
SDK-verification, source-permission, execution-authorization and gate flags. They
are not a public history response, an execution grant or proof of provider authorship.

## Verification

The explicit native command is `node packages/data/test/postgres.integration.ts
--owned-content-readset`. It runs disposable PostgreSQL migrations twice, the
existing authenticated HTTP/Temporal/native-Git save/reopen journey, then the new
production content reader with the native corpus graph. Twenty decoded records
match the independent test-only crypto/SDK oracle exactly: four scope exchanges
and both development roles. All fifteen early record-group denials, all seven
early key-group denials, and late policy/key/source/expiry/revision/hold changes
reject at their intended boundaries.

The isolated content/corpus portion uses **52 simulated provider attempts**: twelve
source-repository, thirty-nine identity and one JWKS. It performs 34 caller checks,
13 metadata grants, 80 independent record policies and 40 independent key policies.
One physical key is read twice; six role transactions execute 51 SQL statements.
The fixture adds an explicitly separate oracle copy/decode of the same 20 rows;
that test-only crypto work is not claimed as production work. The single undelayed
1,820 ms sample is not warmed p95 or an application speedup. Actual application
confirmation/recovery/repeat remain **7,637 / 7,609 / 7,607** attempts.

Forty-one focused tests (eleven new content groups, fifteen owned records groups,
ten prototype groups and five diagnostics groups), eighteen existing-store tests,
prototype/eight-package type checks, 95-artifact kit validation and the read-only
workflow-scope audit pass. No complete integration suite or browser check is claimed.

Three unsuccessful native attempts are retained in [verification](VERIFICATION.json).
Development checks caught strict fixture construction, JSONB key-order comparison
and a nested content lease closing before the enclosing final caller check. The
last issue was reduced to a failing focused regression, then corrected: the outer
request owns validity, while the inner callback still closes recheck admission and
drains/wipes keys. Temporary stack-frame-only diagnostics were removed before the
passing native run. No checks were disabled to make it pass.

## Integration boundary

This composes production crypto/key ownership with 0305's metadata-first SQL owner.
It does not promote the test-only SDK oracle, install a factory binding, or activate
real records/key services. Production SDK/operation/lineage verification, authorized
target discovery, the existing application service contracts and separate phases
around effects still need integration. This retained-history target requires known
operation/review/revision IDs; it is not initial capture with invented placeholder IDs.

The unchanged full C22 protocol remains required. Neither an isolated reader count,
a new test, nor a single undelayed sample earns a checkpoint. Real model quality,
records adoption, GitHub saving and human UI acceptance remain separately required.

The API-key safety skill kept testing within synthetic fixtures: no real credential
read, live model call, spending, runtime GitHub save, records adoption, deployment or
signature. The existing application, user drafts, roadmap and outputs are preserved.

**Intent capture: 68% (17/25; eight remaining; +0 percentage points).**
