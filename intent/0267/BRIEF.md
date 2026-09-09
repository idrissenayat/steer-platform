# 0267 — Continue an amendment without silently changing its target

A proposal created at commit B targets earlier commit A. Current final review
must stay current at B, but correction of that same proposal must retain A.
Resolve that protocol mismatch without stale scope review, fake same-commit
fixtures, canonical overwrites or implicit rebase.

Support unchanged-target continuation only after exact parent verification,
original/current item-surface comparison and independent current eligibility.
Expose both revisions in the actual package chooser and preserve explicit human
selection through preview and confirmation. Changed targets remain unavailable.

See [specification](SPEC.md), [evidence](EVIDENCE.md) and
[process guide](../../docs/EXISTING-CANDIDATE-DESTINATION.md).
