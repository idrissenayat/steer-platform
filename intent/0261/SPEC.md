# Specification

- Add `intent.candidate.save.prepare` as a human-only, separately granted HTTP/MCP
  command. Accept only exact preview references/digest, its confirmation binding
  and an explicit confirmation flag. Reject source bytes and caller operation IDs.
- Reconstruct the current verified package and latest preserved draft. Compare
  every confirmation field and the preview digest before any admission. Require
  an independent current human/records authorization port; a flag or hash is not
  consent authority, records-policy adoption, Gate 2 or write permission.
- Share the existing admission implementation between API and worker, preserving
  the publication/submission hash domain, fixed execution expiry and SQL uniqueness.
  Mint one server operation ID; do not claim a step or reserve a model budget.
- Under the existing organization admission lock, reject candidate-save recovery
  across changed execution configurations or ambiguous prior rows. Server config
  rotation cannot allocate another save for the same preserved draft revision.
- Keep draft-records and save-execution configuration revisions separate. Their
  tenant, owner, product, repository, branch and records policy must match.
- Capture the exact admitted request in the existing encrypted immutable store.
  Read it back and verify original bytes, admission, key, owner and lifecycle.
  Recheck the complete current package and draft before acknowledging preparation.
- A possible effect followed by failure is unknown, not success or permission to
  resubmit. Retain any known original reference. An explicit identical preparation
  may recover the same admission under unchanged authority; no automatic retry,
  new operation, renewed expiry, scheduler or provider dispatch is allowed.
- Bound server preparation to four active requests and 90 seconds, retaining slots
  until pending work drains. Browser command transport has a 100-second bound,
  fixed HTTPS same-origin destination and bounded request/response bodies.
- In the actual package panel, require explicit confirmation, retain the exact
  recovery command and known status link after uncertainty, disable package
  substitution, and clear private state on context/identity/visibility/expiry.
  Say "original preserved", not "saved to GitHub". No alternate preview app.
- Verify authenticated HTTP/MCP, real React interactions, lost SQL admission and
  original acknowledgements, exact API/worker identity and encrypted readback in
  the composed 34-source recorded-SDK journey. Use only synthetic authority.
- No dependency/migration changes, protected artifact edits, credential inspection,
  paid calls, live activation, runtime Git writes, authentication bypass or gate.

Reference-only workflow start, existing-proposal selection, uncaptured-admission
diagnostics and real signed-in/source/records/provider acceptance remain open.
