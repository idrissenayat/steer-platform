# Development specification

The new steer-qualified-retirement-decision/v1 authority schema derives from the
frozen human schema without editing it. It removes deletion/reference-copy fields,
keeps the original complete identity/qualification/assignment/provider/target/time/
replay/CAS fields, permits truthful none/active/released hold metadata and adds exact
selectorInventoryDigest, eventId, eventBindingDigest, corpusId, corpusVersion,
previousEventDigest, historyHeadDigest and corpus-retired decisionKind. It is not
a hold/reference schema alias. All six authority times use exact nanosecond parsing.

The shared human factory adds a closed qualified-retirement selector and distinct
steer-qualified-retirement-human/v1 policy/envelope. Existing disposition,
qualified-event and qualified-reference contracts/policy bytes are unchanged. The
new selector uses all nine original supporting records and exact 300-second
qualified freshness checks; its inventory must name one RC-CORPUS-PROVENANCE record.
Current keys remain unique across domains/eras, with original material/windows
preserved. A standalone human ALLOW is not complete event/history binding.

Trusted steer-retirement-decision-context/v1 pins original organization/item scope,
optional environment, parent record/revision/corpus/version, exact event ID/digest,
ordered prefix history digest and selected current registry. Input cannot install
this configuration. The closed steer-retirement-decision/v1 envelope pins policy/
config and supplies actual event, ordered history, full human bundle and history head.
Event/provider signatures and complete event schemas/order/scope are verified at the
explicit current observation. Every event must match the exact parent/class/revision/
retention-policy scope. The selected event must be corpus-retired with the qualified
owner commit source and records-owner actor role; a prior retirement denies.

The separately signed retirement-history-head from authoritative-lifecycle-store
binds this config, profile policy, registry, complete prefix history, exact previous
event and truthful hold metadata. It follows the previous event, precedes the human
decision, is at most 300 seconds old and has a positive validity interval no longer
than 300 seconds, strictly unexpired at audit. Empty history is explicit and still
requires a complete signed head. Completeness is a trusted-source assertion, not
a live inventory/history discovery in these offline fixtures.

The full human proof must bind exact event bytes excluding only the event's signing
wrappers, exact parent/corpus selector digest and one selector inventory row. Its
actor, corpus, predecessor, history-head digest, conditions and safeguards must all
match. Conditions also bind this exact profile policy. Human provider proof covers
every canonical authority field. CAS and replay snapshots follow the history head
and precede the decision; the winning reservation must follow decision/snapshots
and precede or equal retirement commit. No replayed or losing reservation can pass.

Success is verified-retirement-decision-evidence, retirementAuthorityVerified=true
at the explicit observation, factOnly=true and currentActionAuthorityRequired=true.
It includes exact config/policy/registry/event/history/head/human/reservation/input
hashes, times, hold metadata and nine consumed record IDs. Effects are zero;
executionAuthorized, deletionVerified, liveProviderUsed, futureArchiveVerified and
qualifiedPriorHistoryVerified stay false. Prior hold metadata is checked for
sequence/truth but complete prior hold-owner proofs belong to the separately
required qualified parent history composition. Retirement is not permission to erase
held records, and old approval records are not renewed for future use.

UTF-8 limits: trusted config 128 KiB, registry 64 KiB, whole envelope 16 MiB, human
bundle 1 MiB and history head 64 KiB. Existing event/history/human sub-verifier
bounds remain. Unknown fields, changed pins, malformed time and missing clock deny.
Original 2026 and fresh 2033 decisions are synthetic distinct observations, not
seven-year retention or a current audit of an old decision. No current-v7 admission
or new catalog hook is provided. The shared schema import is fingerprinted as a
source dependency, not retirement-profile execution credit.
