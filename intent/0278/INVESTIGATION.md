# Read amplification: next bounded engineering change

Status: investigation and implementation proposal, **not implemented or activated**.
The measured transport partition belongs in [evidence](EVIDENCE.md). Do not infer
that this proposal changes a signed architecture, current policy or live authority.

## Observed composition

Confirmation reconstructs a preview before admission and after original retention.
Each read-only preview performs final-package review twice. Each final-package
review performs source review twice. Each source review recollects the corpus
twice. These layers also retain distinct draft, scope, role and destination checks.
That composition explains repeated work, but only measured transport attribution
can establish which provider path dominates. Do not equate all head lookups with
identity merely because the URLs share a repository.

## Candidate next change: request-owned immutable corpus verification

Investigate a private read session for source review, not an authorization lease:

1. The initial collection must still enumerate current Git head/tree, verify every
   consumed blob and its digest, check trusted lifecycle/product selection and
   per-source permission, and report all coverage gaps. Capture the exact internal
   input/configuration/reader binding and the complete set of **consumed** paths,
   including manifests and Exam bytes needed for pointer verification even though
   they are excluded from scope assessment.
2. A later read-only revalidation could reuse those immutable verified bytes only
   after reading current head, rechecking current identity, inventory permissions,
   every lifecycle selection and every consumed-source grant, then rechecking head
   and caller authority. Changed head, permission revision, selected roots or any
   binding must invalidate the session. Unknown/incomplete collection must not
   become successful or infer new intent through this path.
3. An opaque request-owned session must establish provenance; an HTTP-provided
   digest, client-created object or cross-request cache cannot do so. Each request
   must retain its own current caller and cleanup. Neither expired evidence nor
   historical permission may authorize a current source read.
4. Source review is read-only. Never keep such a session across confirmation
   admission, original writes, scheduling, model dispatch, Git writes or publication.
   Closure/timeouts must withhold output and retain bounded admission until ignored
   cancellation drains. Keep existing deadlines and separate policy callbacks.
5. Before selecting implementation, review equivalence against source/head moves,
   source revocation after an earlier read, lifecycle changes, excluded/inaccessible
   roots, malicious snapshot substitution, corrupt content, concurrent requests,
   cancellation and late callback failure. A failed fresh check is not a reason to
   fall back to old bytes or silently retry into new consent.

This may remove repeated immutable inventory/body work and their duplicate guards
without caching a grant or reducing Git-head freshness at an actual read boundary.
It is a hypothesis, not a claimed performance gain. If safe equivalence cannot be
shown, leave the full collector in place and pursue another bounded change.

## Verification before claiming delivery

Add focused current-authority/lineage/cleanup negatives, then run the same
authenticated 34-source workflow and compare total **and origin-partitioned**
traffic. Preserve six synthetic model reservations, one immutable confirmed
original, one native Git commit and exact reopen after lost acknowledgements.
Run affected SQL and broad regressions. Do not raise deadlines, shrink the corpus,
skip semantic acceptance or use a passing fixture as signed-in UI completion.
