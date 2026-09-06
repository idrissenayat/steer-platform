# Spec

## Exact source and signer-set composition

Add the internal `createGitGateSignerCollector` composition. Trusted startup selects
the existing gate-source configuration and a bounded ordered signer list containing
each real proof-reader configuration and expected identity-mode proof facts. These
are not HTTP inputs. Reuse the actual existing schemas and constructors, including
required identity/role sources and qualification sources for specialists.

Bind every configured signer to the gate organization, repository, item, gate number,
artifact revision, contiguous sequence and unique subject/hat pair. Current collection
input contains only exact source revision and decision digest. All configured proof
decision digests must match that input before any source lookup.

Collect the actual gate record, its verified digest, inventory entry and unchanged
governed artifact set using the existing observer. Validate the entire canonical
signature roster against the selected list before signer-specific evidence reads.
Require exact count/order, subject, hat, sequence and signing timestamp. Declared
type must be human when present; declared session/authentication metadata must
agree with selected and subsequently verified proof facts. Preserve send-back and
declined decisions instead of recasting them as approvals.

Invoke the actual provider/identity verifier for every ordinary human signer and
the actual specialist verifier for every specialist. Missing or forged evidence
for any signer rejects the collection; no partial successful result is returned.
Derive normalized signatures exclusively from verified claims, with qualified
domains from the verified specialist child. Canonical declared qualified domains,
when present, must exactly match those verified domains. Recollect the exact gate
and unchanged artifact set after all signer observations.

## Ownership and clocks

Use one outer 15-second real/logical deadline and monotonic clock across the entire
collection, in addition to each child's existing deadline. Guard every provider
read and authentication continuation. Pin the service actor across all children,
and preserve its earliest observed expiry; a later authentication cannot extend
that ceiling. Timeout denies the caller while retaining ownership of pending work;
late continuations cannot issue further reads. Shutdown closes admission, drains
owned work and then shuts down the child observers. It does not claim cancellation
of arbitrary already-dispatched provider I/O.

A failed in-flight collection closes this collector permanently and drains every
child before clearing active ownership. In particular, a child returning its own
timeout does not mean its underlying read has ended. Use a new collector for a
later separately authorized attempt. Input-only rejection before work starts does
not close the collector, and healthy completed collections remain reusable.

Return immutable canonical source evidence, normalized record, all individual
signer observations and evaluation time. Always return policyVerificationRequired,
currentSignerRevalidationRequired, gateVerified false and writeAuthorized false.

## Limits and remaining integration

Final source recollection proves the same record/artifact head, not that every
historical/current human grant and attestor lease is simultaneously live at the
later completion instant. Complete action authority must revalidate signer leases
and current source at its own decision boundary. No long-lived authorization is
created by this collection.

The configured proof facts/trust roots, qualification pins and domain requirements
still need selection from approved governed policy/review sources. Prerequisite
gates, Critic/domain reports, full policy and any build evidence remain unverified
here. Actual attestor bindings/receipt issuance, existing commercial provider-record
compatibility, independent review and human approvals remain due. No new HTTP tool,
runtime profile, provider permission, live writer or frontend action is installed.
