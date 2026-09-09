# Intent 0286 — Remove duplicate nested repository-read authority checks

Reduce repeated fresh authorization in source review without caching permissions
or weakening current source/lifecycle, exact-byte, deadline or recovery controls.
Use a private construction proof only where the same bound policy really runs
before and after a nested read. The target is partial progress on
[C22](../../docs/INTENT-CAPTURE-PROGRESS.md), not live UI acceptance.
See [specification](SPEC.md) and [evidence](EVIDENCE.md).
