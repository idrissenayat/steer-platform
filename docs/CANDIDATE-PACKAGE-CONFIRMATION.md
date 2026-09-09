# Confirm and preserve the exact package

0261 connects the actual editor's [package preview](CANDIDATE-PACKAGE-PREVIEW.md)
to explicit human confirmation and immutable original preservation. It is not a
separate application. Preview remains read-only; confirmation is a separate command.

## Human interaction

After reviewing the exact package, choose **Confirm this exact package**. STEER
rechecks the package and attempts to preserve its exact original. A verified
acknowledgement says **Original preserved**, explicitly **not saved to GitHub**.
No workflow or provider write starts from this action. Reference-only save-start
composition is separate in [0262](CANDIDATE-SAVE-START.md); the runtime factories
remain uninstalled.

If the acknowledgement is uncertain, the panel keeps the exact command and any
known original-operation status link. **Recover this exact confirmation** repeats
only that preparation under current authority. It does not ask an agent to draft
again, allocate a replacement operation or dispatch a save. Package selection is
locked during this recovery so a changed destination cannot silently replace it.
An explicit pre-admission conflict returns the person to package review.

Context/identity changes, hiding the page and session/records expiry clear private
display state and abort the browser request. Aborting is not rollback. The server
original, if admitted, remains governed by its records policy. All-revision
diagnostics for configured scope/development admissions are separate in
[0264](PREPARATION-DIAGNOSTICS.md); coverage does not include every save preparation,
refresh cannot be presented as proof that no operation exists.

## Server sequence and authority

`intent.candidate.save.prepare` is a separately granted, human-only HTTP/MCP
command. The browser sends the preview references/digest, exact proposed binding
and `confirm: true`, not documents, profiles, lifecycle claims or an operation ID.
The authenticated subject must match the confirmation and configured owner.

1. Read the exact latest preserved draft and reconstruct the complete 0260
   preview: current scope/direction, both retained SDK roles and destination.
2. Compare the preview digest, all confirmation fields and fixed service committer.
   Invoke mandatory trusted human-consent authorization before admission and
   throughout preservation. A browser flag, matching digest, tool grant or
   configured policy digest is not independent proof of adopted records authority.
3. Use the shared API/worker admission path. The existing domain-separated
   submission digest includes fixed publication configuration and excludes the
   not-yet-minted operation ID. SQL admits at most one original submission for
  the configured draft revision/action; expiry cannot be renewed on replay.
   Candidate-save admission checks prior rows across execution configurations
   under the existing organization lock. Changed configuration or multiple legacy
   rows is a conflict, not a newly minted operation. A genuinely revised submission
   requires a separately preserved and reviewed draft revision; recovery cannot
   silently manufacture it. The development-role admission contract is unchanged.
4. Derive the existing step/receipt digest using the real server-minted ID. Store
   all three exact documents and confirmation in the existing encrypted candidate
   original store, verify the admitted operation, and read every byte back under
   current keys, lifecycle and records authority. No plaintext is stored in SQL.
5. Reconstruct the complete preview again and recheck current draft and human
   authority. Return `prepared` only after these checks and exact readback.

The returned reference is the existing save-status reference, with the **step-plan
input digest**, not the separate admission digest. API preparation and worker
preparation use the same publication hash and return the same operation ID.
Neither path claims a step or reserves model spending during preparation.

Records configuration and execution configuration revisions may differ. Their
tenant/owner/product/repository/branch/policy must agree; the records revision is
the one used by the preserved draft and historical package verifier. There is no
implicit migration or activation under the previously accepted memory-only policy.

## Uncertain outcomes and limits

Once admission may have happened, failures are conservatively **unknown**. A lost
admission acknowledgement may have no returned reference. A lost original-write
acknowledgement may include the known reference. Recovery repeats the identical
confirmation with unchanged configuration and fresh authority, converging on the
same SQL operation and original; it never starts a provider write. If source,
destination, expiry or authority changed, preparation must not claim readiness.
The original may still require read-only diagnostics or reconciliation.

Four requests and a 90-second overall server deadline bound preparation. Timed-out
dependencies retain their slots until they drain; closed children cannot admit
late work. The dedicated browser command transport uses fixed HTTPS same-origin
credentials, no redirects/storage, 20,000-byte requests, 50,000-byte responses and
a 100-second deadline. It is not added to the read-only transport allowlist.

The factory has no model, provider writer, scheduler or signer dependency. The
existing worker independently checks current source/lifecycle/consent/gate/write
authority at actual dispatch. Preserving an original does not authorize dispatch.

## Remaining acceptance

D1 adoption, an approved model-test budget, real destination/source/lifecycle/
human-consent/provider authority and signed-in I1–I6 acceptance remain open.
Existing-proposal selection and configured preparation diagnostics are implemented
separately; they do not grant confirmation, continuation or retry authority.
Reference-only save start is now implemented separately in
[0262](CANDIDATE-SAVE-START.md); confirmation alone still never schedules it.
Production React, SQL and recorded-SDK fixtures demonstrate software behavior,
not live human acceptance or authority. See [0261 evidence](../intent/0261/EVIDENCE.md)
and [the current plan](INTENT-JOURNEY-PLAN.md).

0268 composes native Git corpus/destination resolution with the encrypted SQL and
recorded SDK history behind this confirmation command. Lost admission/original
acknowledgements recover one exact original and match worker admission identity;
the test never dispatches Git. See [0268 evidence](../intent/0268/EVIDENCE.md).
0269 now connects fixed save execution and verified reopen to this same joined
path; see [its evidence](../intent/0269/EVIDENCE.md). Confirmation alone still does
not start work. Next complete governed startup composition and activation checks.
