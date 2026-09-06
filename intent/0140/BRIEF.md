# Brief — Common completion-time signer validity

## Need

Item 0139 verifies every canonical signer, but an earlier verified key, role or
qualification can expire while later signers or final artifact reads run. A set
of individually successful observations must not hide this timing gap.

## Outcome

Derive exact exclusive validity bounds from the sources already verified by the
actual provider reader, then require every signer to remain within those bounds
at one final collection instant. Preserve fresh-source and full-policy requirements.

## Boundaries

Development only, on the candidate branch. No protected Exam, signature, trust-root
approval, new provider access, live write, release, deployment or spending. Existing
commercial provider-recorded approvals are not converted. All five R5 findings remain.

This is not a fresh login, a current-source cache lease or complete gate authority.
Historical login validity still concerns authentication/signing, not today's login.
