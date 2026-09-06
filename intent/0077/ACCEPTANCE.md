# Development acceptance · not a protected EXAM

- Repeated identical terminal envelopes verify at later current clocks without
  modifying original signed graph bytes and always produce zero-effect REPLAY_NOOP.
- Configuration, grant, plan, complete chain, aggregate, tombstone and result
  substitutions deny even when the terminal record is freshly signed.
- Complete independent committed terminal/current proofs are required; missing
  records, wrong links, forks, checkpoint statuses and new winners deny.
- Native/current expiry and exact time boundaries remain enforced; a newer
  terminal expiry cannot rescue an expired original graph.
- Original human, action, receipt and checkpoint proof omissions deny.
- Forged, wrong-domain, unknown-field, noncanonical and oversized input denies.

Synthetic tests do not constitute independent review, real storage or a gate ruling.

