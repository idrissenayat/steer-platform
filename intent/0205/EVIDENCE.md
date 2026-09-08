# Development evidence — 2026-09-07

Base: `bb015ebc509a164565fed6a68b047a720de07dce`.
Implements the user's request following the revision-2 design review.

## Delivered code and boundaries

- `packages/tool-registry/src/intent-revision-contracts.ts`: exact-byte scope
  fingerprints, cumulative dependency invalidation, strict save-binding comparison
  and old/current/different-workspace completion classification. Save comparisons
  are not yet consumed by a bundle-save service and do not grant authority.
- `apps/web/app/intent-conversation.tsx` and `intent-scope-review.tsx`: actual editor
  revision/invalidation state, earlier source/direction labeled historical, and
  honest final-review setup status. Originals and explanations remain; typing does
  not call search, models or storage. Existing memory-only/session-clearing limits
  remain prominently disclosed. No fake preview was added.
- `packages/tool-registry/src/intent-evidence-contracts.ts`: whole-document evidence
  with exact SHA-256/Git blob checks, source/target/range validation, explicit coverage
  gaps, and output citation validation. The initial small-corpus envelope includes
  at most 32 sources, 32,000 bytes per source and 128,000 bytes total. Larger or
  unavailable sources remain unassessed; no context is silently truncated. The
  caller must still authorize and resolve the complete declared inventory at head.
  Tests preserve the exclusion-heading and paraphrase examples but do not prove
  semantic classification. The existing lexical query is unchanged.
- `packages/domain/src/intent-step.ts`: pure immutable step-transition planning with
  input/caller/config bindings, fencing, pre-dispatch lease takeover, reservation
  reuse, one-way dispatch, uncertainty quarantine and result-digest checkpointing.
  No durable operation uniqueness, transaction, reservation insertion, dispatch
  acknowledgement or Temporal execution is implemented by this pure planner.
- `packages/tool-registry/src/candidate-bundle-contracts.ts`: inert seven-file new
  candidate/revision and six-file amendment plans, immutable bundle manifests,
  pointers, operation receipts, exact bytes, destination/head/input fingerprints
  and lifecycle/previous-pointer preconditions. Only unreviewed/stale review states
  are accepted. It performs no Git calls; future adapters must enforce all authority,
  current scope/consent, symlink/path, CAS and provider-readback requirements.

## Verification

- Node 24.19.0: full domain + registry suites **192/192 passed**; full web suite
  **100/100 passed**. Focused new contracts plus the expanded actual React
  interaction test **32/32 passed** (overlapping the full-suite totals).
- Domain, registry and web typechecks passed. Next production build passed.
- Actual component regression covers generation-versus-interview scope, Exam-only
  correction, Brief correction/undo, historical direction, preserved originals,
  zero additional search/model calls on edits and no browser persistence.
- Both owned STEER Next renderers and the HTTPS gateway were restarted after the
  build. Verified TLS request to `https://localhost:8443/` returned 200; port 3000
  also returned 200. This establishes availability, not visual or first-login QA,
  successful generation, semantic model quality or actual Git-save acceptance.
- Kit validation passed (95 required artifacts), workflow token-scope audit passed,
  and whitespace checks passed. Signed architecture SHA-256 remains
  `9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65`;
  protected Exam remains `84ad1d4c14d6614fe4b53509104e379e9ad6dff0462c96109901eefb1e02fd7f`;
  accepted HR-01-R2 policy remains `f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32`.
- API-key skill safeguards preserved the existing resolved credential choice;
  no secret or model call was needed. No skill introduced an activation or extra
  application. Existing untracked `docs/REAL-USER-ROADMAP.md` and `outputs/` were
  preserved and excluded from this implementation.

## Remaining work

Disabled manifest discovery/reopen/writer adapters, durable operation/worker
integration, complete inventory/contextual retrieval and real semantic evals,
authorized revision storage, final-scope UI and real save/reopen remain. The records
amendment is unsigned; the model test budget and runtime Git-writing authority are
not enabled. No real private draft, database migration, key, grant, budget, signed
architecture, original Word doctrine, protected Exam or accepted policy was changed.
