# Brief — Native domain-review source fidelity

## Need

The 0141 collector reads normalized development review files. The project already
has canonical `steer-domain-review-record/v1` records with detailed findings,
escalations, boundaries and evidence references. Those records must be usable
without rewriting their bytes or turning their assertions into verified authority.

## Outcome

Normalize the native Gate 2 domain format conservatively and connect it to the
existing source/policy collector. Read every referenced artifact, including evidence
listed only under resolved findings, at the original reviewed revision. Require
the complete fixed startup evidence allowlist before following any report link.

## Boundary

Source integrity is not reviewer identity, fresh-context proof, independence or
governed approval. This increment issues no review or signature, alters no protected
record and enables no provider access, live write, release, deployment or spending.
All five R5 findings and existing approval boundaries remain.
