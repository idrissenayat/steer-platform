# Specification

## Shared contracts

- Command `intent.brief.save` requires a current human, exact organization and
  explicit preview/save/save-status grants. Readback `intent.brief.save.status`
  requires current human and its own grant. No actor or authority comes from input.
- Closed create-only input binds organization, repository, branch, canonical
  `items/NNNN-slug/BRIEF.md`, expected branch head, UUIDv4 idempotency key, original
  draft facts and `accept-rendered-brief` confirmation of the template/content SHA.
  No arbitrary path, existing-blob overwrite, author or gate field is admitted.
  The original 12,000-byte preview bound still applies to the facts; the outer
  confirmation envelope is bounded separately at 14,000 UTF-8 bytes.
- Before writer I/O, regenerate with the existing authenticated-author template.
  Require title, problem, outcome, users/systems and structurally readable sections.
  Unknown remaining details stay in the draft; this is not Gate 1 readiness.
  Verify exact confirmed SHA-256 and compute exact Git blob SHA-1. Bind all parsed
  input facts, actor and content to a deterministic versioned request digest.
- Scope is an explicitly installed writer configuration with at most 100 exact
  paths and pinned platform revision/Gate 2 decision digest. No runtime profile,
  environment flag or production adapter enabling this writer exists in this item.

## Execution and readback

1. Revalidate identity before authoritative operation-marker inspection and before
   disclosing even absence or historical completion. Unavailable is never absent.
2. A matching committed marker returns the original receipt without another write.
   The same key with different request content/base conflicts. Pending/unknown state
   cannot trigger new dispatch. No new key or blind rebase/retry is generated.
3. For verified absence only, revalidate identity, obtain full verified adapter
   membership/Gate 2 authority, then revalidate identity again immediately before
   checking its exact scope, subject, request/base, authority source and gate pins.
4. Authority is a narrow current-runtime observation: millisecond ISO timestamps,
   at most five seconds old, at most thirty-second lifetime, unexpired and no later
   than the human session. Submillisecond signed timestamps are rejected here, not
   truncated or treated as evidence of the broader R5 precision obligations.
5. Dispatch one compare-and-create. The real adapter must atomically create the
   absent Brief plus immutable `.steer/authoring/operations/<uuid>.json` marker at
   the exact expected head, and verify both through code-host readback. It must
   enforce idempotency across processes and never force, overwrite or project first.
6. A thrown/malformed/mismatched response, or revoked identity after dispatch,
   returns unknown. That is not rollback or permission to create another request.
   Later separately authorized status may discover the original committed revision.

| Observed outcome | Meaning / permitted next step |
|---|---|
| not-found | Authoritative readback absence only. Save may proceed only through all other checks. |
| committed | Trusted adapter verified exact marker/artifact metadata; never a gate signature. |
| pending | Same operation is unresolved; inspect it, do not create another operation. |
| conflict | Base/key/path precondition failed; review current state before a different confirmed request. |
| unknown | Completion cannot be established; read back with the original scoped key. |

Every public result carries `gateSigned: false`. No content, provider credential or
private error payload is returned. HTTP/OpenAPI/MCP share the same definitions.

## Trusted seam, not a substitute for evidence

`BriefWriter.verifyWriteAuthority` must verify complete actual current source and
provider evidence. A `policy-satisfied` result, a normalized object, a hash or the
`verified-brief-write-authority` label alone cannot implement it. The core checks
the adapter's exact output binding; this item does not implement that verifier.

This first profile requires the governing membership and Git-resident write-admission
record to be co-located at `expectedHead`, so atomic branch CAS fences later source
changes. Other authority stores, independently mutable provider-review approvals,
multiple issuer namespaces or cross-repository admission need explicit additional
verification/composition. Do not silently bind them using this profile. The real
adapter must also have bounded I/O and truthful uncertain-outcome handling.

Tests use an in-memory synthetic CAS/marker port, not a live store or cryptographic
Gate 2 review. The production composition remains absent/closed. No gate is signed,
no frozen artifact edited and no real GitHub installation permissions changed.
