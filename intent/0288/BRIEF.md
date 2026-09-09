# Intent 0288 — Remove duplicate caller checks in current-scope validation

Reduce drafting-start request load without changing the current-only scope,
records, source, expiry or scheduling authority. A privately constructed read
policy may prove it already checks the exact same caller before and after work.
Only that redundant outer pair can be omitted; both full current scope reads and
each independent policy remain. No proof may cross a scheduler effect or become
historical/current clearance. See [specification](SPEC.md), [evidence](EVIDENCE.md)
and [raw request measurements](PERFORMANCE.json).

This advances C22 only; overall remains 68% (17/25; 8 remaining; +0 points).
