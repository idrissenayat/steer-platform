# Execution route

1. Define managed session-resource and exact binding contract at the API seam.
2. Compose existing Git identity API under explicit admission/shutdown state.
3. Unit-test delayed requests/resources and failure/idempotence without fake success.
4. Use the service in the real Chromium/provider/Git/Postgres integration.
5. Recheck shared harness/root checks, document and push candidate.

Next: validated runtime bootstrap/configuration and local production UI wiring;
keep real identities/credentials, public activation and formal gates separate.
