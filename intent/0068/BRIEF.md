# Brief: Source-faithful lifecycle retention

## Intent

Make the composed retention decision follow the exact policy accepted by
HR-01-R2, while preserving frozen review artifacts and current key checks.

## Observed gaps

- The 0061 rebuildable selector used the last trigger, despite the policy's
  explicit earliest-supersession/rebuild rule.
- The frozen lifecycle table substitutes item closure for the provenance rule.
  The accepted policy instead requires the later of corpus retirement and the
  maximum verified derived-record deletion over a closed inventory.
- Existing composed positives covered immediate/raw records but not capped
  derivative/export disposition or the full class-level scheduling inventory.

## Scope

Correct those two candidate rules, bind a closed provider-signed derived
manifest into current authority-signed state, and test class outcomes, compound
selection, holds and parent caps. Offline zero-effect evidence only.

## Exclusions

No frozen policy/table edits, retrospective signatures, registry-window
extensions, store reads/writes, production routes, deletion, release or spending.
Long-retention disposition, reference-revocation completion, archival/current
key semantics and independent acceptance remain separate work.
