# Specification

## Input and current authority

`POST /v1/tools/intent.development.prepare` accepts organization/product/repository,
draft UUID/revision/digest, scope input digest, reviewed source snapshot digest,
expected configuration revision and the human's explicit direction/reason. It is
a human command with its own exact tool grant and repeated current identity checks.
Wrong owner, product, repository or configuration fails before service access.

The request cannot supply source document bodies, model profiles, budget amounts,
expiry, records-policy adoption or execution permission. The server factory fixes
the complete execution configuration and both role profiles. Exact retry keeps
those bytes, including the original expiry; changing them cannot renew an existing
operation under the same configuration revision.

Current draft/key authorization, trusted evidence retrieval and preparation
authorization are mandatory dependencies. The evidence service must actually
establish permitted source inventory/lifecycle/provenance and current permissions;
the preparation-authority service must verify the actual human direction and
current records/profile/budget rules. No browser flag, tool grant or parsed envelope
implements these services. The production evidence/authority binding remains absent.

## Assemble and admit

1. Read the actual encrypted draft revision and require it to be the latest revision
   with the exact requested digest and scope fingerprint. Preserve original text,
   every clarification turn and all three current document strings verbatim.
2. Retrieve evidence through the trusted service. Validate whole-document byte/blob
   hashes, scope and the reviewed source snapshot. Return `scope-incomplete` with
   aggregate coverage when inventory, access or document inclusion is incomplete;
   create no operation or original in that case. A complete empty permitted corpus
   still depends on verified inventory authority and is not a semantic novelty claim.
3. Build the existing exact development-original contract using fixed profiles and
   the human's choice. A linked/extension target must occur in the pinned evidence.
   Recheck current source, evidence and preparation authority before admission.
4. Create/recover the existing unique SQL operation for draft revision/action/
   configuration, bound to the complete original digest. No model reservation or
   dispatch occurs. Recheck source/evidence, preserve the encrypted original, read
   it back exactly, then recheck current source/evidence/authority before acknowledging.

Evidence/profile/expiry changes cannot overwrite the original or silently create a
new attempt for the same admission key. Changed source requires review of the new
revision. All evidence input ordering and profile bytes form part of the exact
original; the trusted retrieval adapter must supply a stable representation on replay.

## Outcomes and recovery

Outcomes are `prepared`, `scope-incomplete`, `conflict`, `unknown` or `unavailable`.
Only `prepared` can say `originalPreserved:true` and `readyToRequestStart:true`, and
it must include an operation UUID/input digest and complete declared coverage.
Readiness is eligibility to request the separate current-authority start command,
not execution authorization. Unknown may include an already acknowledged operation
reference without claiming the original is preserved. Other outcomes do not return
an operation reference. Incomplete coverage cannot claim ready state.

All outcomes explicitly retain false semantic-review/authoritative-clearance,
execution, document-ready, Git-save and gate flags. Scope/coverage counts are not a
semantic assessment. No private original, evidence body, prompt or secret is returned.

Lost operation/original COMMIT acknowledgements stay unknown. An exact replay under
current permission can recover the existing records; no expiry refresh, cost reset,
automatic workflow start or deletion occurs. Permission loss after storage conceals
the response without undoing storage. A stale scope after partial admission may
leave retained metadata; it is not a prepared or runnable acknowledgement.

Each service admits four concurrent requests with a 30-second overall bound.
Timed-out external and connection dependencies retain admission until drained;
close prevents subsequent service work and closes owned stores. No real service,
records key/grant, migration, model call or runtime Git writer is installed.
