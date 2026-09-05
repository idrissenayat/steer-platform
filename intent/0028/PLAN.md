# Execution route

1. Add explicit local HTTPS transport with bounded sockets and owned lifecycle.
2. Compose it with the real identity runtime/gateway under a strict public profile.
3. Verify synthetic TLS, admission, startup rollback and actual request/resource drain.
4. Replace only the browser fixture's application listener with production source.
5. Verify full browser flow, root checks, documentation and candidate push.

Next: authenticated workspace/session view and trusted secret-provider loading,
while preserving the existing real-credential and release approval boundaries.
The renderer process remains separately supervised and receives public flags only.

