# Spec

## Composition

Export `createRequestBoundGitHubBriefWriter` from `@steer/adapters/github-brief-writer`.
Construct one instance per trusted authenticated invocation, with exact organization,
repository, branch, target allowlist, platform revision and Gate 2 decision digest.
Require a trusted issuer, current verified-context authenticator, full authority
verifier, provider transport and App JWT supplier. Configuration is parsed and
frozen. No environment-based or production bootstrap is added.

The authenticator must be the actual trusted OIDC/browser-context composition,
not an HTTP-provided object. The authority callback must independently verify all
applicable current/historical source, human, qualified-hat, prerequisite, Critic,
domain and gate requirements. A well-shaped receipt is not sufficient evidence.
That full verifier remains unfinished; the factory refuses an absent callback.

## Identity and authority

- Before and after reads, require a current human with exact scope/subject and
  `intent.brief.save.status`. Status-only grants cannot create or authorize a write.
- Writes require all preview/save/status grants. Reject expired contexts, future
  establishment, wrong issuer, duplicate hats/grants and foreign caller facts.
- Bind repeated checks to the original issuer, subject, organization, establishment
  instant and session binding, retaining the original session expiry ceiling.
- Verify exact request hashes, UTF-8 bytes and operation-marker path. Validate the
  authority receipt against exact request/head/platform/gate pins, five-second
  maximum age, thirty-second maximum lifetime and all checked identity expiries.
- Obtain fresh full authority between current session checks. The underlying store
  repeats this after narrow write-token issuance, before its single mutation.
- Preserve the store's CAS, exact two-file commit/readback and duplicate recovery.
  Reading an already committed operation does not create another commit or require
  another gate proof; it still requires the request's current grants and identity.

## Lifecycle and uncertainty

Each method has a real fifteen-second deadline, rejects backward/nonfinite clocks
and overlapping use, and holds admission closed until timed-out dependency work
settles. The deadline also checks injected logical time. `close()` denies future
steps; it is not an arbitrary dependency cancellation or a draining shutdown API.
No subsequent provider call can start after timeout/close is observed. A provider
request already dispatched may finish and must not be described as rolled back.

Post-storage identity failure returns an exact-reference unknown outcome. A method
deadline can reject; the existing shared save orchestration maps dispatch failure
to unknown. Recovery uses authorized status reads, not blind mutation retry.

## Limits

No full authority-verifier implementation, provider compatibility conversion,
trusted-key selection, live writer binding, browser save/status UI or board is
delivered here. The 0124 bounded linear-history/protection prerequisite remains.
Native disposable Git plus synthetic provider/authentication/authority dependencies
is development evidence, not GitHub-side enforcement or an approved real journey.
