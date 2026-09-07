# Development acceptance

- Native commit/tree/blob/path-history/comparison reads determine the receipt.
- No browser interception, new credentials or network fallback establishes success.
- The actual UI reads the original receipt after later commits and reconstruction.
- Missing operation is not-found; committed grant denial suppresses provider reads.
- Every request writer closes; shared storage remains owned by its parent harness.
- Draft facts/content stay unchanged, storage stays empty and save stays disabled.
- Browser and full regressions pass; seeded history is not described as a saved
  platform operation or provider/human approval.
