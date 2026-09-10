# 0323 — Explicit ownership of review caller checks

Remove duplicate caller brackets only where the exact constructed, read-only
review producer already owns fresh checks before dependent work and after IO.
Keep ordinary readers, independent callers, source/records/key validation and
effect-separated phases intact. A denied or unfinished caller cannot release a
review, even if a producer swallows its error.

Base: `b1d54161227b0c4c667457840bddf47e25aaae39`. Partial C22, not a whole-path
performance fix. No model spending, live runtime saving, activation or signature.
