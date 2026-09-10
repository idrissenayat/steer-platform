# 0324 — Verified readback from candidate preservation

Return the exact verified original already recovered at the end of candidate
preservation, and use it in confirmation instead of immediately recovering the
same record again. Preserve immutable storage, key comparison, durable hold and
expiry restrictions, exact admission/confirmation checks and fresh previews on
both sides of persistence. Keep legacy acknowledgement-only callers unchanged.

Base: `ffa9c343495d18253a7cbd081282b31a8b0db60c`. Partial C22 only. No live model
spend, runtime GitHub artifact save, activation, deployment or gate signature.
