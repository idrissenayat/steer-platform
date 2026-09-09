# Development evidence — 2026-09-09

Base: `90551b9ce750380e5e5d74143b4e639179416b3c`.

## Implemented

The existing destination adapter now verifies selected proposal parents and
compares original/current item surfaces while keeping current scope review intact.
An additional explicit governed eligibility proof is mandatory. The pure preview
contract binds both revisions and exact parents; the actual chooser displays them
and no longer treats an older original target as an automatic incompatibility.
Changed targets and unavailable policy stay closed; nothing is silently rebased.

## Verification

Focused native destination/contract checks pass (26 tests, including seven new
continuation scenarios); all nine actual-component tests pass. The initial native
run found derived inventory fields were incorrectly sent back through a strict raw
inventory parser. The comparison adapter now explicitly removes only those derived
fields and revalidates the raw snapshot; no raw schema checks were weakened.

All **1,287 regression tests pass**, including the seven new native continuation
scenarios and revised pure/actual-component checks. The prototype and all eight
package type checks, optimized Next 16.3.4 production build, 95-artifact kit validation
and workflow token-scope audit pass. `git diff --check` passes; protected Architecture,
Exam and accepted retention-policy hashes match the previous checkpoint.
All **308 local links across 12 changed documents** resolve. The user-owned roadmap
and outputs remain untouched and unstaged.

The separate **focused candidate-save SQL/Temporal/native-Git run passes 40 checks
plus idempotent migration verification**. This covers existing admission, immutable
encrypted originals, lost acknowledgements, fixed Temporal execution/cancellation,
single native save and recovery invariants. It is regression evidence, not a new
claim that the continuity resolver is installed in the encrypted SQL/SDK preview.
No full SQL-suite result or schema change is claimed. The harness reports removing
only its own synthetic PostgreSQL container and tmpfs data.

## Evidence limits

The native fixture creates target A, proposal commit B and correction commit C;
the second continuation retains A and verifies the advanced exact parent at C.
It uses owned native Git object databases and synthetic provider transport. Final
scope reviews, recorded-generation lineage, principals and policy eligibility are
synthetic. The API test composes the human-only HTTP query with native destination
verification and pure planning, not the encrypted SQL/SDK generation-history stack.
React component tests do not establish a live signed-in walkthrough or visual QA.

The comparison itself does not prove ancestor lineage or cross-item semantic
impact. Those remain explicit obligations of the mandatory governed policy
verifier, which is not installed or implemented by a matching hash. Real records
adoption, model/provider/write authority and I1–I6 acceptance remain open.

No model calls/spend, runtime GitHub writes, deployment/release, provider grant,
credential change, real-record deletion or gate signature occurs. The API-key skill
preserves the resolved credential decision and synthetic-only test boundary.
Tests clean up only their owned temporary resources; user work is preserved.
