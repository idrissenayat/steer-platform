# Assessed direction contract

1. The actual editor requires a complete current assessment for non-empty reviewed
   evidence. It matches owner, organization, product, repository, saved revision,
   scope fingerprint and batch-plan digest. It revalidates full result/citation
   bytes before requesting preparation. Any newer source requires fresh review.
2. The browser sends only `scopeReview: {kind: recorded, reviewId,
   preparationDigest, resultsDigest}` alongside the exact human direction. It
   cannot supply findings, prompts, model settings or authority. Recovery preserves
   the same request bytes; the reference does not leak into start input.
3. `createAssessedRecordedDevelopmentPreparer` requires this selection and uses
   `createVerifiedScopeReviewReader`, with its configured recorded-SDK verifier,
   encrypted SQL observations and current authority. Reader output must be current,
   complete, exact-owner/latest-source and equal to the requested result digest.
   Recomputing all batch results against current evidence verifies citations and
   coverage, not semantic truth. References alone are not provider provenance.
4. The empty alternative is `{kind: empty-corpus, planDigest}`. The server must
   verify an explicitly complete inventory with zero documents and no planning or
   access gaps. It rechecks evidence before and after admission. No scope model
   review is required for that case; no empty inference is allowed for failures.
5. Store the full verified binding under `original.direction.scopeReview`, inside
   the existing encrypted immutable original. Its bytes participate in the
   operation input digest and both role contexts. Never include prior Exam or
   Architect commentary in the fresh Test Agent context. Total record/request byte
   limits and the existing smaller generation-envelope coverage limit still apply.
6. Bound originals require the current scope reader again on restore, including
   preparation, start, worker request reconstruction and result-consumption paths.
   Missing reader, changed profile/corpus, denied source, incomplete or expired/
   superseded assessment fails closed. No result grants start, budget or save rights.
7. The v1 field is optional only for historical compatibility: existing originals,
   hashes and legacy tests stay unchanged when omitted. The legacy preparer is not
   the new live journey composition. New wiring must use the assessed factory and
   pass a separately configured pinned reader through all downstream record ports.

No migration, dependency, provider switch, auth bypass or runtime installation.
Assessed historical originals with expired/superseded scope cannot currently be
reopened through this current-assessment path; a separate authorized historical
reader remains necessary. Do not silently renew execution to display them.
