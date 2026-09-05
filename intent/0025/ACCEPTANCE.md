# Development acceptance, not an independent Exam

| Requirement | Check |
| --- | --- |
| Strict profile/secret separation | Extra/secret profile fields and malformed downstream configuration rejected |
| Actual production components | App signer/reader, bounded pool, encrypted store and lifecycle assembled |
| No implicit access or readiness | Zero provider calls/connections at construction; 503 ready and 401 tools |
| Real encrypted storage from bootstrap | Synthetic login transaction created, read with matching key and consumed |
| Owned startup cleanup and shutdown | Generic startup errors; stopped state and zero connections |
| Composition-only dependency access | Exact-file imports accepted only in runtime.ts, rejected elsewhere |
| No stack/version/policy drift | Frozen install, lockfile-only declaration changes and root/browser checks |

No live membership, automatic secret loading, listener/public activation or gate.
