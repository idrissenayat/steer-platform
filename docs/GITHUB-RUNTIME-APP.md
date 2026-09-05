# STEER runtime GitHub App

Observed on 2026-09-05 UTC (2026-09-04 EDT), from GitHub's authenticated
registration, permissions and installation pages. This is provider setup
evidence, not Gate 2 approval or a working end-to-end runtime.

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

**Current blocker:** the user must complete the private-key download through
their own browser and provide the saved file path, not the key contents. If the
original download cannot be recovered, a replacement key is needed. Verify the
replacement before requesting retirement of the inaccessible original key;
do not delete keys without the required approval.

No PEM has been retrieved or stored by this task. No runtime App JWT,
installation token, or signed API readback has been performed. Do not mark
the provider integration ready on the strength of UI installation alone.

## Next verification

1. Secure the user-provided runtime PEM outside Git, with directory mode 700
   and file mode 600; confirm its public fingerprint against GitHub.
2. Read back the App and installation using the runtime identity. Verify owner,
   App/installation/repository IDs, selected scope, permissions and no events.
3. Use the existing restricted-token adapter to read a revision-bound artifact
   on the candidate branch and verify the blob/content hashes. Never print
   JWTs, tokens, PEM contents or repository artifact bodies in evidence logs.
4. Record redacted provider evidence, then continue identity and ingestion
   composition. Keep real writes, deployment, spending and gate signing closed.

While the credential handoff is pending, the continuous implementation task is
paused at this user-only blocker; do not repeatedly generate keys, repeat the
unchanged request, or claim background implementation progress.
