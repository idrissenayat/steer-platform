# Spec

- Extend the internal selection proof with optional issuer/type identity binding
  plus historical grant path/revision/digest. Identity-aware evidence must include
  the complete set, matching independently expected facts; trust binds issuer/type.
  Legacy subject-only evidence stays readable but cannot satisfy grant verification.
- Add optional attestation `authorization` configuration with path, issuer, actor
  type, exact historical revision and digest. Those exact source coordinates must
  be covered by the signed payload, not inferred from a same-subject record.
- Reuse `steer-authorization/v1` documents. Require the distinct internal capability
  `gate.policy.select` both at selection time and now. Gate observation, saving,
  signing or hats cannot substitute. This adds no callable tool or live grant.
- Require an active exact issuer/subject/type/organization record in both eras,
  reject duplicate identities and cross-tenant records, use exact half-open UTC
  grant windows and reject agent human hats. Configured human and hat-free agent
  selectors can be represented; no default real selector or required human hat
  is chosen by this evidence reader.
- Read the pinned historical document and independently reread the current same
  path. Verify exact source coordinates, bytes, SHA-256 and Git blob identity,
  current observer and current head. Do not reuse old grants or unpinned history.
- Retain both source fingerprints and immutable grant-binding evidence internally.
  Bound output validity by the current grant as well as the proof and key; recheck
  expiry after later policy reads. Reuse existing deadline, single-flight and drain.
- Keep selector grant paths disjoint from selected evidence, human membership and
  authoring targets. Keep held diagnostics bounded and all held requirements and
  gate/write flags unchanged, even with valid grants and policy-satisfied facts.
- Verify exact-time positive/negative controls, proof downgrade/coordinate attacks,
  native Git revocation, source corruption, late expiry and held zero-write behavior.
