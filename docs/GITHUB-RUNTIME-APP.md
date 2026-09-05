# STEER runtime GitHub App

Observed on 2026-09-05 UTC (2026-09-04 EDT), from GitHub's authenticated
settings pages and signed API readbacks. The read-only provider adapter has
passed a live artifact read. This is not Gate 2 approval or a working
end-to-end platform runtime.

## Identity and scope

| Field | Observed value |
|---|---|
| App | `steer-platform-runtime` |
| Owner | `idrissenayat` |
| App ID | `4836171` |
| Client ID (not a secret) | `Iv23li2k5t62HhupFp61` |
| Installation ID | `159172046` |
| Repository ID | `1349965471` |
| Selected repository | `idrissenayat/steer-platform` |
| Installation scope | Only select repositories; exactly one selected |
| Permissions | Contents read-only; mandatory Metadata read-only |
| Other repository permissions | No access |
| Organization/account/enterprise permissions | None requested |
| App availability | Private, only the owner's account |
| Webhooks | Disabled; no event subscriptions |
| OAuth/device flow | Disabled; no callback or setup URL configured |

- [App settings](https://github.com/settings/apps/steer-platform-runtime)
- [Installation settings](https://github.com/settings/installations/159172046)

GitHub displayed the successful installation notice and the saved one-repository
selection with read access to code and metadata. GitHub also notes its standard
public-repository read access; runtime binding must still reject repositories
outside the explicitly configured numeric repository ID.

The independent `steer-test-agent` App remains separate. Its settings and key
were not changed or accessed. The runtime App cannot author protected Exams,
write repository contents, approve gates, deploy, or spend.

## Authorization and credential handoff

The user approved creation of this separate read-only App, then explicitly
approved private-key generation, owner-only local storage outside Git, and
installation on this single repository at the access-grant step.

One private key was generated, but Chrome blocked the download with
`ERR_BLOCKED_BY_CLIENT`. A readback showed GitHub key ID `4354007`, fingerprint
`SHA256:ovvh+36/qUGG47/rvfIOE7BPmuPmMdsB/ljRQIvXDKQ=`. No matching runtime-key
file was found in Downloads. The browser tool also blocked access to its
download manager. No browser protections were bypassed and no second key was
generated automatically.

### Credential handoff resolved

The user completed a replacement download and reported it ready. The exact
runtime PEM was found in Downloads, validated as RSA 2048, and its public-key
fingerprint matched GitHub key ID `4354040`:
`SHA256:uG41s8LHpEtVQDmPmEMNUAeAZ1hEBb51lO4/mBjP/pg=`.

The file was moved, without overwriting an existing file, to
`/Users/idrissenayat/.config/steer/runtime-github/private-key.pem` outside Git.
The containing directory is mode `700`; the file is mode `600`. The original
Downloads copy was moved rather than duplicated. Key bytes were not printed,
committed, added to browser storage or sent to another provider.

After successful authentication with the replacement, the user explicitly
approved permanent revocation of only unused key `4354007`. GitHub's settings
readback confirmed that only replacement `4354040` remained. This revocation
cannot be undone; the independent Test Agent keys were untouched.

## Live verification

At `2026-09-05T02:28:26.367Z`, signed requests to `/app` and
`/app/installations/159172046` verified the expected App, owner, installation,
selected-repository mode, unsuspended installation, exactly Contents/Metadata
read-only permissions, and an empty event list.

The existing `createGitHubReader` then requested an installation token restricted
to numeric repository `1349965471` and Contents read-only. Its returned
repository list contained exactly the expected repository and its returned
permissions passed the adapter's least-privilege checks. The reader resolved
the candidate branch, read a commit/tree/blob-bound artifact, validated the
Git blob hash and SHA-256 content digest, and rechecked an unchanged branch head.

| Evidence field | Value |
|---|---|
| Branch | `codex/phase-1-foundation` |
| Revision | `7aad6588b2faba3cd67e1d6b0745130e23a58ab6` |
| Artifact | `docs/PHASE-1-DELIVERY.md` |
| Git blob SHA | `569fa351238d61c5c08034bf9cd13a8ec13526fb` |
| Content SHA-256 | `38e7365b7ba2e765ec011a8117f85048f926f9b6ae2e848adee9b08fe0bec46c` |
| UTF-8 bytes | `9668` |

At `2026-09-05T02:30:02.245Z`, after unused-key revocation, a fresh signed App
read and fresh restricted installation-token branch read both succeeded again.
Only public binding metadata, hashes and status were logged; tokens and
artifact bodies were not logged. Tokens were held only in the short-lived
verification process. No repository-content write or production-data action
was attempted.

The verification-only `organizationId` (`steer-runtime-verification`) is a
local test label, not an authoritative STEER tenant membership or access grant.
This exercise does not establish the operating-repository authorization source,
configure browser login, enable default API authentication, or ingest records
into a production database.

## Next integration

The credential handoff is complete; the implementation loop may resume safe
bounded development without requesting the same App/key approval again.
Continue local Keycloak/browser, trusted membership-source configuration and
durable ingestion composition. Use this runtime identity only within its
approved read scope; do not discover or reuse Test Agent credentials. Keep
real writes, deployment, spending, release and gate signing closed. Store no
JWTs, tokens or PEM contents in repository configuration or evidence logs.
