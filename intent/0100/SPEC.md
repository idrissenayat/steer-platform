# Specification

1. Map all 32 original AUTHORIZATION cases through 0066. Reuse exact frozen
   mutations, verify ten records plus an independent observation, retain ALLOW
   and REPLAY_NOOP as recorded decisions only, and report zero effects.
2. Map all 20 SPEND cases through 0064 with eight records in the positive control.
   Preserve the literal unknown input, malformed time and expiry boundaries;
   build trusted clocks independently of malformed request time. Replay cannot
   authorize execution or skip current store evidence.
3. Map all 34 COST cases. The 28 non-reconciliation cases use 0064; six
   reconciliation cases use 0057/0063. Move original scalar variance/successor
   bytes into single-element plural arrays without re-signing or rewriting those
   records. The graph's scalar slots must be empty. Preserve original failures.
4. Overflow IDs execute the exact frozen arithmetic operands and observe the
   actual NANOUSD_OVERFLOW error, plus rejection of a complete signed aggregate
   graph. Positive aggregate controls establish aggregation before cent rounding.
5. Upgrade the 19 PRIVACY-GRAPH IDs to 0063 with all ten signed records, six
   explicit observed-as-of times, a trusted clock and independent observation.
   Preserve exact frozen mutations and require a complete positive control.
6. Inventory construction is test-side and independent of candidate outputs.
   Incomplete inventories are allowed only in malformed negative fixture
   construction; the actual verifier must deny them. No keys/general signer are
   exported, and no real credentials or provider inputs are loaded.
7. Closed hook selection adds 86 IDs, not 105: the privacy IDs already existed.
   Unknown kinds fail. Assertions propagate. Seal actual input/output/assertion
   observations plus supplemental hook/fixture source digests. Keep the source
   catalog and all earlier reports unchanged.

Original authorization does not prove the newer shared-action contract. Original
one-line reconciliations do not cover multi-line completeness. Wider native/current
time precision, later trust eras, integrations and independent/protected review
remain separate. No success is permission for a side effect or gate signature.
