# Implementation plan

1. Add an explicit lazy worker service with truthful ordered cleanup.
2. Cover start/stop races, repeat calls and failure cleanup in native tests.
3. Add an isolated IPC child using actual worker/runtime/Git/Postgres composition.
4. Kill/restart owned children during durable timers, inspect same-run readback,
   event counts, current revocation and normal-stop resource acknowledgements.
5. Run full checks, document exact evidence and remaining gaps, commit and push
   candidate implementation without changing protected or signed records.
