# Development acceptance, not an independent Exam

| Requirement | Development check |
| --- | --- |
| One Git authority for browser and bearer | Production composition factory; API bearer test and actual browser integration |
| No injected resolver bypass | Extra untyped dependency resolver never invoked |
| Fixed valid artifact path | Invalid path construction rejected |
| Revoked, missing or malformed membership denies | Actual synthetic Git commits; next request returns 401 |
| No stale fallback after source failure | Outage, head drift and digest fault checks, followed by verified restoration |
| Provider/storage/browser guarantees preserved | Existing Chromium groups plus assembled HTTP integration |
| No production activation or real grants | Default readiness stays 503; fixture-only repository and cleanup |

Tests: `apps/api/test/git-browser.test.ts` and
`apps/api/test/browser-auth-harness.ts`. Evidence must distinguish synthetic
Git commits from the separately verified live read-only GitHub binding.
