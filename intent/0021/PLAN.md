# Execution route

1. Add explicit bounded admission without per-client mutable authority.
2. Consolidate body reads under actual-byte/chunk/time limits and safe cancellation.
3. Set local Node HTTP receive/parser/socket limits.
4. Test saturation/failure/slow-stream and actual loopback HTTP behavior.
5. Recheck Chromium integration and root suite, document and push candidate.

Next: database/pool execution deadlines and trusted runtime configuration before
production sign-in UI activation. Fleet-level ingress remains a separate proof.
