# Development acceptance · not a protected EXAM

- All 16 exact accessibility IDs execute in full profile with expected results.
- The full positive consumes 32,900 raw rows with the expected signed row digest.
- Negative cases bind the passed positive from the same actual run, never a saved report.
- Actual consumed prefixes are unambiguously sealed, counted and closed without tail reads.
- Consumer, malformed-row, limit and cleanup failures cannot produce success.
- Preflight failures consume zero rows; a row-level failure records its actual prefix.
- Quick and full profiles retain the entire required catalog and explicit uncovered counts.
- Quick: 307 passed / 3,729 uncovered. Full: 323 passed / 3,713 uncovered. Zero failures.
- Strict completion stays nonzero; no unmapped full-profile case is waived.
- A fresh full integration run matches the saved full snapshot.
- All manual-audit, live-provider, execution and independent-acceptance boundaries remain false.

Passing a negative case does not mean its matrix was valid. All five formal R5
findings and GAP-01 remain open.
