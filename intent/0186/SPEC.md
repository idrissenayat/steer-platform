# Spec

- Add an internal Ed25519 verification-only contract with a distinct signature
  domain. No production signing function, provider call, package export or live key.
- Bind organization/repository/branch, selector subject, record item, platform
  revision, decision digest, manifest path/digest, complete configuration digest,
  selection event ID and selected-at instant against externally provided expected
  values. Independently require exact trust and proof digests.
- Use closed schema-ordered compact JSON, bounded valid UTF-8, strict signature
  encoding and exact nanosecond UTC chronology. Require key activation before
  selection, selection before recording, recording before observation, and finite
  proof expiry no later than key expiry. Current revocation caps validity.
- Bind manifest content, not the proof's containing commit: a self-referential Git
  commit cannot be signed into a file in that same commit. Current-source checks
  must separately establish the manifest still matches those exact signed bytes.
- Add optional `selection.attestation` with pinned trust/proof refs and selected
  actor/event/time. Only the two-gate save-policy chain supports this profile.
  Trust/proof/manifest paths must be distinct and not alias existing source roles,
  human membership records or authoring targets. Missing configured proof denies.
- Read exact current native Git bytes, SHA-256 and blob identities with current
  observer checks and head checks. Validate proof before following gate sources;
  recheck its finite validity after the full policy collection before returning.
  Reuse existing single-flight, deadline and draining lifecycle.
- Return immutable evidence only. Governed-selection, selector authorization,
  trust bootstrap, review provenance and current-source requirements stay explicit.
  Held writer must deny even a valid proof; no successful authority callback.
- Cover genuine synthetic signatures, tampering, repinned substitutions, expiry,
  revocation, source corruption, current head/observer drift, role aliasing, existing
  no-attestation behavior and zero writes through the held composition.
