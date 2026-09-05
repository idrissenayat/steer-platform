# Implementation plan

1. Read installed Next.js 16.3.4 CSP/dynamic-rendering guidance and verify current
   gateway isolation and the existing dynamic page boundary.
2. Add fresh gateway policy/nonces, preserving all credential and resource limits.
3. Verify native policy/isolation and real Chromium framework/negative CSP cases.
4. Rerun authentication/forms/accessibility and repository checks; document scope
   and any fixture corrections. Publish candidate and verify exact remote commit.

Next: bounded browser transport and reference-consumer UI binding, followed by
full operating models/screens. Canonical gate source/proof and remaining services
stay separately tracked; no gate, provider or spending authority is inferred.
