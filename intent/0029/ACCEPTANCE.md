# Development acceptance, not an independent Exam

| Requirement | Verification |
| --- | --- |
| Current authorized context only | Cookie/session/Git revalidation and shared session.context grant |
| No request-selected identity | Empty-body/query/Origin checks and spoofed-header rejection |
| No credentials in renderer/HTML | Strict projected keys, constructed headers and actual browser token-absence check |
| Revoked/unavailable context removed | Browser reloads for revocation and Git outage/moving-head/digest failures |
| Native accessible UI | Sign-out, refresh link, keyboard focus, 390 px no overflow and axe tags |
| Source-faithful visible scope | Account ID instead of guessed name; all three work surfaces explicitly not connected |
| Visual QA | Reviewed synthetic desktop/mobile screenshots |

A page-load snapshot is not continuous authorization. Independent protected
reviews, specialist accessibility, real ingress and full product parity remain.

