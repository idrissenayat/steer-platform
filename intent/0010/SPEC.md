# Specification

- Pin one organization, installation, numeric repository ID, owner/name and
  branch in trusted configuration. Request an installation token restricted
  to that repository and contents-read. Reject broader returned scopes.
- Bound token expiry and cache only until its refresh margin. Pin GitHub API
  origin/version; reject redirects, non-success responses, oversized response
  streams and invalid response structures. Never log credentials or body data.
- Resolve configured branch to a commit; verify commit and tree identities.
  Read only regular blobs from nontruncated trees at that commit. Reject path
  traversal, symlinks, submodules, oversize, bad UTF-8, bad base64 and blob-hash
  mismatch. Return content SHA-256 plus source identity and revision.
- Provide a generated-key-testable App JWT signer with RSA and bounded lifetime.
  No key discovery, env loading, token creation against real GitHub or writes
  run automatically.
- Resolve authorization only from an explicitly bound path, exact organization
  and fresh Git head. Require closed document/record schemas and unique
  issuer/subject identity records. Read the head again before accepting the
  record; head drift, missing data, wrong scope and provider failures deny.
  No stale-data fallback is allowed. OIDC still enforces active/expiry/cutoff.
- This resolver is for a trusted configured/protected operating repository.
  Branch protection and authorized membership authorship must be established
  before live composition. It does not assert its own configuration authority.
