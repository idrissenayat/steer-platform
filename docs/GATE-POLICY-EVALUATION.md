# Strict gate-policy evaluation

Increment 0043 adds evaluateGateDecisionPolicy in the provider-free tool-contract
package, exported through @steer/tool-registry/gate-policy. It evaluates normalized
facts; it does NOT verify those facts came from an authorized human or source.
A policy-satisfied result is not approval and always includes
sourceVerificationRequired: true. Do not expose it as a signing endpoint.

## Evidence contract

Inputs bind the target and record to organization, repository, item, gate, exact
artifact revision and record digest. Policy supplies its digest, operating profile,
activated closed-domain set, user-facing status and additional specialist domains.
Each normalized signature supplies human/service type, subject, active-hat fact,
sequence position, server-time fact, subject-bound session/authentication-time facts and qualification
coverage. Prerequisite, Critic, build evidence and domain-review/exception references
must be supplied explicitly. Unknown fields, invalid encodings and oversized lists
deny. The evaluator returns stable codes, never input values or provider errors.

These are facts for a trusted verifier to normalize, NOT claims to accept from
browser/agent input. A string saying human, a qualification tag or a report digest
does not authenticate anything. The future source/proof adapter must retrieve and
independently verify exact records, active hats/qualifications at decision time,
session binding, source/currentness and complete policy inheritance before using
this component. It must preserve historical attribution after hat transfers.

## Policy checks

Required primary hats follow the current Gate 1/2/3 model, including Product
Designer for user-facing Gate 3. Normalized sequence positions cannot skip,
duplicate or reorder primary seats. A specialist assertion must cover each
required domain; regulated closed work requires all activated domains and at
least two distinct contributing human subjects. Multiple hats/sessions held by
one person do not satisfy regulated separation. User-facing Gate 3 requires
accessibility coverage. Additional policy and domain-review triggers add coverage.

Only approved records can satisfy policy; declined and send-back stay blocked.
Signature times cannot be future, reverse order, precede prerequisites, or be
at/before the passing exact-revision fresh-context Critic. Closed work requires
zero unresolved Critic findings. Gate 3 additionally requires current passing
Exam and plan-conformance evidence. Gate 2/3 require the immediately preceding
approved gate in the same organization/repository/item scope.

Commercial closed Gate 3 sessions must differ from EVERY Gate 2 signature
session. Looking only at one previous session per subject, or accepting one new
session while another signer reuses an old one, is insufficient. A different
session authenticated at or before the build Critic also fails even if the
signature is later. Authentication must precede signing, and one session cannot
claim different humans or authentication times. These checks implement the policy
meaning of SIG-12/WS-12 without claiming their end-to-end signing cases passed.

Closed-domain evidence must have exactly one current independent fresh-context,
high-confidence passing review for each activated domain, zero unresolved
findings, unique report digests and an exact complete set of links from the current
exception brief. Missing, stale, duplicate, self-reviewed or unlinked evidence
blocks. Activated domains cannot be silently relabeled default-open.

## Explicit limits and next work

This is a normalized aggregate evaluation, not the canonical signature envelope,
a specialist-seat write protocol, a proof format, a global event sequence or an
independent review. In particular, normalization must establish signer/session
identity, qualified active hat, evidence provenance and deterministic human-review
triggers from the actual source; the evaluator cannot establish those by itself.

No public tool, gate action, Git write, workflow advancement, approval mirror or
release binding is added. The fixture prototype remains separate. Gate-source
observation from 0042 still emits only record provenance; its observation is not
silently upgraded into policy-verified approval. canonicalGateSourceVerifierVerified
remains false. No historical signature or protected Exam is changed.

Sources: intent/0001/SPEC.md, EXAM.md signature matrix/WS-12 (read only), and
accepted docs/decisions/0001-agent-first-domain-assurance.md. Development evidence:
intent/0043/EVIDENCE.md. Next: independent source/provider-proof normalization and
verification, then event cursors/public gate composition and business surfaces.
