# Specification · development candidate

## Explicit entry point

`createCurrentLifecycleGraphVerifier(configBytes, trustedRuntimeBytes)` in 0061
shares the complete existing lifecycle body with the original factory. The
original factory and its policy digest remain pinned to original trust. The new
factory always reports executionAuthorized=false, including blocked and retained
results. It has no effect executor, provider client or runtime route.

The trusted `steer-lifecycle-runtime/v1` context contains exactly
currentRegistryBytes, currentProviderRegistryBytes and historicalContextBytes.
Maximum context size is 256 Ki UTF-16 units; registry/record limits apply within.
The history/current-human factories validate the current trust registry, preserving
every historical anchor. Archive and lifecycle contexts must share that exact
registry, scope, record/class and artifact revision.

Provider bindings preserve the complete original set of providerBindingId, domain,
provider, account, tenant, proofType and proofIssuer. Their selected signing key,
algorithm, public material, windows and revocation must exactly match the current
registry. Neither caller claims nor a different still-valid key in the same domain
may supply the resource proof or receipt. Duplicate, missing or changed provider
identities deny at configuration time.

## Graph and policy binding

The new graph version is `steer-lifecycle-graph/current-v1`, with one additional
required field, historicalEvidenceBytes. Its policy digest binds the original
lifecycle policy plus the runtime-selection policy and exact trusted runtime
context digest. Version confusion, old policy pins and request-installed runtime
fields deny. No automatic format or signature migration occurs.

Supported classes are explicitly limited to RC-SECURITY-AUDIT (one year),
RC-CORPUS-BASELINE (three years), RC-DECISION-PROOF and RC-LEGAL-SIGNED-LOG (seven
years). Other classes, including raw and referenced evidence, are closed on this
path. Their original paths are not expanded by this increment.

## Full verification sequence

1. Verify the complete historical event/provider bytes using 0078, including
   original observation, exact archive selection, current independent witnesses
   and known-revocation denial. Require exact equality with the graph's entire
   ordered history/current event bytes. No digest-only substitute is accepted.
2. Verify current complete inventory and independent history-bound state under
   current keys. Archive retention proof must exist no later than that state.
   Historical holds remain enforced; an active current hold/reference retains.
   A claimed released state without corresponding historical hold events denies.
3. Derive the unchanged calendar retention boundary. Before expiry schedule;
   incomplete or premature effect evidence at/after expiry cannot pass.
4. Require full current human proof separately for every copy, then the full 0060
   protected action and exact selected-provider receipt. Bind the complete current
   registries and historical evidence through the action input/context digests.
5. Verify every ordered receipt against the complete aggregate, and verify a
   separate fully authorized human/tombstone action and provider receipt. Exact
   first/replay proof modes retain the existing winner/result constraints.

All signed request, provider, authority, resource, receipt and tombstone chronology,
scope, uniqueness, policy, current expiry and zero-effect rules remain required.
Historical eligibility does not revive an expired human approval or credential.

## Evidence boundary and remaining work

This is a synthetic offline full composition, not a real delete transaction or
runtime trust/key rollout. It does not retrieve archive/current state from a live
source, prove atomicity or certify a qualified human signature. The historical
envelope currently covers the entire event history: later current-key events
cannot yet be appended to an old-key archived prefix. That mixed-era history path
remains closed. Referenced-object revocation/retained-verification and other record
classes require their own complete evidence before being admitted. All five R5
findings and independent/protected review remain open.

