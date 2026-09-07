# Held Brief governance in the identity runtime

The optional `heldBrief` identity profile contains the existing strict `writer` and
Gate 1/2 `policy` configurations. It is paired with an explicit trusted
`authenticateGateObserver` dependency. Missing either side, malformed sources,
foreign bindings or different platform/decision pins reject startup. Nothing is
discovered from a browser request, role header, environment default or token claim.
Construction is lazy: no source request, observer call or database connection occurs.

## One request, two identity roles

The configured identity service creates a managed held writer per request, with
human identity re-established by its existing OIDC/browser-session boundary and
current Git membership. Gate-source collection separately checks the configured
agent observer and its current `gate.observe` grant. The observer is never inferred
from the human's hats. Its independent identity lifecycle remains with the trusted
callback owner; the runtime drains its in-flight collector work before closing its
own resources.

This composition uses the real existing held factory. `verifyWriteAuthority` and
`compareAndCreate` always deny. It never mints a full-authority proof, requests a
GitHub write token or performs a create mutation. Even a `policy-satisfied` observation
does not establish governed evidence selection, independent review authenticity or
complete action-time authority. A local content confirmation does not change that.

## Diagnostics are not authority

Internal `runtime.status().heldBrief` always reports `writeAuthorized: false` and
`gateVerified: false`. `lastAssessment` is the last immutable completed source
assessment, including exact source/platform/decision pins and missing-evidence codes.
It is historical, not a current readiness query, cached approval or authority lease.
It has no public endpoint, frontend display, persistent store or gate effect.

Later writer inspection/assessment clears that diagnostic before source work. An
unauthenticated request may be rejected before creating a writer; it cannot refresh
the historical observation or upgrade its authority. Shutdown clears the diagnostic
immediately, drains admitted requests and cannot repopulate it from a late result.
The stopped runtime rejects new requests without provider access.

Optional `heldBrief.policy.selection` now binds the complete configured policy chain
to one exact current Git manifest. A missing/mismatched configured source fails the
assessment; a match contributes only `selectionSource` fingerprints. This neither
adopts file-supplied configuration nor clears `governed-selection-unverified` or any
other authority requirement. No live manifest or pin is installed. See
`docs/GATE-POLICY-SELECTION.md` and `intent/0170`.

0186 optionally verifies `selection.attestation` from separately pinned current Git
trust/proof files. Those roles cannot alias membership records or save destinations.
A valid selected-key proof does not approve the trust bootstrap or selector and
does not remove any held requirement. Internal collection retains the attestation;
held diagnostics still expose only the bounded selection fingerprints, not new
actor claims or an approval flag. See `intent/0186/EVIDENCE.md`.

## Verification and remaining boundaries

Increment 0169 verifies the production runtime using actual signed OIDC and App JWTs,
native Git current membership and cryptographic signer-source collection. Identity
JWKS and GitHub network responses are synthetic and have no external fallback.
The focused journey uses bearer authentication; its encrypted browser-session pool
stays lazy. Passing it does not prove a real-person/Keycloak held-policy assessment,
live provider trust or independently qualified review. Existing browser regression
remains a separate integration of real local Keycloak/session behavior.

Increment 0171 adds a separate disposable browser context for the held profile.
The production authoring UI, HTTPS gateway and runtime use actual local Keycloak
and encrypted PostgreSQL sessions; native Git supplies the declared policy manifest
and current human grants. The held-save path receives no synthetic successful gate
callback. Its historical gate signers, qualifications, review facts and current
observer remain explicitly synthetic, so this is not independent gate evidence.
See `intent/0171/EVIDENCE.md` for current verification results and limitations.

Increment 0172 replaces that journey's direct observer-principal callback with a
fresh actual disposable Keycloak service token. The existing OIDC adapter verifies
it, and the existing Git authorization resolver reads a separate current observer
grant through the read-only App adapter. Committed revocation, missing gate.observe
and invalid-token cases stay separate from current-human revocation. Historical
gate evidence is unchanged and synthetic; this is not a live observer grant or
independent historical review approval. See `intent/0172/EVIDENCE.md`.

No live `heldBrief` configuration, observer grant, GitHub permission or display flag
has been enabled. Full governed selection, review provenance, action-time authority,
all five R5 findings, qualified/independent protected review and human signatures
remain open. No deployment, release, spending or deletion authority is conferred.
