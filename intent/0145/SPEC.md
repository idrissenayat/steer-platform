# Spec

## Explicit development contract

The runner trust snapshot identifies one organization, repository, domain,
reviewer service identity and configuration revision, an HTTPS attestor, Ed25519
key, exact activation/expiry times and optional revocation time. It is selected
and hash-pinned outside request data. Selecting its bytes does not approve that
runner or establish who is authorized to maintain the snapshot.

A runner envelope contains schema-ordered compact JSON signed over the UTF-8
prefix `steer-domain-review-runner-attestation/v1` followed by NUL and payload
bytes. This is not JCS or Ed25519ctx. The payload binds the entire review SHA-256,
path, reviewed revision, item, scope, domain, reviewer/configuration, Builder
identity, independent review and Builder execution IDs, start/review/record times,
and explicit no-inherited-conversation/no-prior-authority/Builder-independence
assertions. Separate reviewer and Builder subjects and execution IDs are required.

Expected target/report/identity/execution fields must match external selection;
the receipt cannot select its own expectations. Verify the real Ed25519 signature,
canonical base64, strict schema, UTF-8 and 16-KiB payload limit. Identifiers are
bounded to 200 characters with no surrounding whitespace or controls. All times
use exact UTC nanoseconds: activation <= start <= review <= record <= evaluation;
key validity is half-open and current revocation denies. Return the earlier key
expiry or scheduled revocation as validBefore, never a fresh-source lease.

## Native Git integration

Native domain references may explicitly configure runner trust/proof path+digest
pins and fixed review/Builder execution IDs. Both sources are required once the
runner selection is present. Verify original current-head Git coordinates, UTF-8,
SHA-256 and blob ID through the existing bounded source reader. The trust/proof
JSON is compact and source hashes must match the helper's schema-ordered hashes.
Native reports retain their original bytes and linked-evidence verification.

Bind the receipt to the selected domain record's exact digest, original target,
reviewer service identity, configuration revision and reviewedAt, plus the
collector's organization/repository and separately selected Builder. Receipt
recording must precede or equal every canonical gate signature. Ambiguous paths
and missing execution identities reject before I/O. No path in the receipt or
report can select an additional fetch.

Retain the immutable runnerAttestation alongside each native domain observation;
it is null when the optional profile was not selected. Once configured, missing,
invalid or stale evidence cannot fall back to raw self-declarations. Recheck every
verified runner key at both the common evaluation instant and final completion,
alongside existing signer validity. Keep the 64-KiB source, 8-MiB aggregate,
15-second deadline, one actor/head, single-flight and draining-shutdown boundaries.

## Limits

A verified signature establishes that the selected key signed these claims. It
does not prove truthful context isolation, source-selection governance, Builder
assignment, runner ownership, complete prior-finding history or review quality.
The result therefore still requires governed runner selection, runner-isolation
verification and current sources; gateVerified/writeAuthorized stay false. The
collector's overall review-authenticity requirement is not cleared.

This new contract is not an actual OpenAI/Codex receipt format and does not convert
old domain records or commercial provider-recorded human approvals. No runtime
attestor, key, external API, package export, writer or review signing is installed.
Native Critic provenance and passing canonical Critic semantics remain separate.

