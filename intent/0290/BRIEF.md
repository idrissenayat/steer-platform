# Intent 0290 — Bounded saved-operation recovery reproduction

Investigate 0289's unexplained `unknown` while recovering an already-sent native
save. Add an explicit bounded reproduction of the existing native Git/PostgreSQL
lost-acknowledgement recovery check and content-free database-clock diagnostics.
Do not change production authority, recovery, clocks, deadlines or write retries.

See [specification](SPEC.md) and [evidence](EVIDENCE.md). This is diagnostic work
toward existing C18/C22 reliability/performance acceptance, not another completed
checkpoint: 68% (17/25; 8 remaining; +0 points).
