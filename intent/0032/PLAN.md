# Execution route

1. Extend the provider adapter with bounded, pinned manifest reconciliation and
   explicit partial-failure/cancellation semantics.
2. Compose the one-shot runtime from actual adapters and a separately supplied
   current agent authenticator, enforcing admission and resource ownership.
3. Test invalid scope/source, skipped updates, aggregate bound, partial failures,
   superseded results and honest cancellation/shutdown.
4. Upgrade isolated Git/Postgres/browser fixture to two artifacts, replay and
   corrupted-projection repair without duplicate history; preserve exact bytes.
5. Run full checks, record evidence and boundaries, push candidate increment.

Next: revision-bound source inventory/manifest integration, followed by durable
workflow scheduling and remaining Phase 1 services. All formal gates stay separate.
