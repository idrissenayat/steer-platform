# Development acceptance

- [x] Exact UTC nanoseconds round-trip without floating-point fractions.
- [x] Invalid calendar dates, offsets, ambiguous precision and overflow reject.
- [x] Calendar-year clamping and parent caps preserve individual nanoseconds.
- [x] Shared signature verification honors exact activation/expiry/revocation.
- [x] All affected candidate policies bind the precise time contract digest.
- [x] Old keys remain expired; new keys cannot authenticate old signatures.
- [x] Legacy composed paths deny unsupported fractional inputs without rounding.
- [x] Full repository checks and protected-diff verification complete.

This is not full nanosecond graph support, archival authority or gate approval.
