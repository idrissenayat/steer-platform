# Execution route

1. Review current broker, API boundary and CSRF/OAuth requirements.
2. Add explicit fixed-origin browser route composition without CLI activation.
3. Verify signed-token HTTP flow, Origin/Fetch-Metadata, methods, empty-body
   bounds, cookies, replay, logout, revocation and generic response behavior.
4. Run root Node 24 checks and document exact development evidence.
5. Commit/push candidate; continue real local human-code integration next.
