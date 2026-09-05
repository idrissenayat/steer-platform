# Development acceptance, not an independent Exam

| Contract | Test evidence |
| --- | --- |
| Login → callback → granted tool → local logout | `apps/api/test/browser.test.ts` signed-token HTTP flow |
| CSRF prevention for auth and ambient-cookie tool calls | Origin/Fetch-Metadata negative cases |
| No side effects for GET/HEAD/OPTIONS on mutation routes | method tests and store counters |
| No open redirect, payload reflection or credential JSON | query/body/error/security-header tests |
| Replay, duplicate-cookie, current grant denial and mixed credentials | replay/revocation/authentication tests |
| Default startup still closed and readiness incomplete | default API and ready checks |
| Accurate browser OpenAPI with unchanged registry schemas | route/cookie descriptions and base-document comparison |
| Package boundaries and existing behavior unchanged | root `pnpm check` on Node 24.20.0 |
