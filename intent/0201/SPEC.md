# Spec

- Mount unselected direction controls in the actual scope-review component.
- Offer proposals to extend existing scope, create a linked distinct intent or
  create a distinct intent; exact-revision opening remains the existing Brief link.
- Extension/link requires a currently displayed parent Brief with its own digest,
  not the matching Spec digest. Every proposal requires a nonblank reason, at most
  3,000 characters. Preserve that reason exactly.
- Before confirming, rerun the authorized existing-scope query. Bind the proposal
  to organization, repository, original-intent digest, catalog fingerprint and
  review fingerprint. Any mismatch rejects confirmation and shows current sources.
- Preserve the explanation during a stale-source retry; edits invalidate the prior
  proposal. Source input changes invalidate the review and proposal. Tenant/repository
  changes and expiry/visibility clearing must not carry explanation to another scope.
- Clearly label proposals unsaved and not yet consumed by drafting/saving. Keep
  incomplete-coverage and lexical-only warnings. A distinct proposal is not proof
  the intent is new, and cannot grant permission or bypass later semantic review.
- No model call, storage mutation, Git write, grant change or automatic disposition.
  Future server drafting/save composition must independently reauthorize and recheck;
  the portable binder and browser proposal are not a trusted server receipt.
