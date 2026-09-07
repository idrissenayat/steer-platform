# Exact-revision lifecycle source coverage

`intent.brief.artifacts` is a read-only shared-registry query. It supplies J3 source
inventory groundwork, not authoritative lifecycle/decision inputs. It is available
through existing HTTP, MCP and internal dispatch. Increment 0191 mounts a manual
**Supporting documents** check in the Next review workspace and Brief dialog.
Neither increment grants it to any live identity.

## Contract

The input is the existing exact Brief tuple: organization, repository, canonical or
supported legacy Brief path, 40-character commit and SHA-256. There are no caller
supplied sibling paths, alternate revisions, stage, signatures or policy fields.
The query requires all three current grants: `intent.brief.artifacts`,
`intent.brief.read` and `projection.artifact.read`. Being an administrator, having
a signing hat or possessing an unrelated review grant is not sufficient.

The selected Brief must first pass the existing exact-source reader. Its sibling
`SPEC.md`, `EXAM.md` and `PLAN.md` are then checked in that order at the **same
commit**, only if each path is already explicitly curated in the projection reader.
At most four source reads occur. Each source is bounded by the existing 512 KiB
UTF-8 ceiling and verified against its SHA-256 and Git blob hash. The response
contains only the selected Brief tuple and three coverage entries with fingerprints;
no source bodies, signer identities, policy facts or credentials are returned.

| Status | Meaning | Does not mean |
| --- | --- | --- |
| `projected` | A matching bounded projection was read and its bytes matched both hashes. | Approved, complete, current Git head, or eligible for any gate. |
| `not-projected` | No matching projection was returned at the requested commit. | The file does not exist in Git. The current projection may be at another revision. |
| `not-configured` | The fixed sibling path is outside the configured reader curation; no read was attempted. | The artifact is missing or permission should be automatically widened. |

An unavailable or digest-mismatched Brief yields `null`, not an empty inventory.
Service failures, malformed/corrupt responses, substituted tuples and access loss
fail the whole request with sanitized errors. They never become `not-projected`.
Current identity and all three grants are checked around reads and before return,
including empty or unconfigured results. No partial response is released after
revocation. Scoped hat-free agents may inspect under the same explicit grants but
cannot convert source statements into signatures.

## Consumer boundary

`stage` is always `null`; `gateVerified` and `writeAuthorized` are always `false`.
Even three projected documents containing recorded approvals cannot advance a
Flight Board stage, establish readiness, populate actionable Inbox assignments,
start clocks or authorize a save. The strict output parser rejects such injected
authority fields and inconsistent entry ordering/status/fingerprint combinations.

This is a bounded observational read, not an atomic database snapshot or a Git
currentness guarantee. It does not assemble cross-revision approved artifact chains;
those need the verified lifecycle contract. The 0191 UI refreshes only on explicit
request and clears on expiry, reset, visibility loss and navigation. The prototype's
claim-derived `buildReadModel` must not be fed these records as verified approvals.

Next: compose authenticated lifecycle/decision authority before connecting real
board stages and review actions. Approved configuration, trust-owner provenance,
independent review and exact human gate signatures remain separate prerequisites.
No curation, live grant, provider access, spending, deployment or gate change follows
from this query's registration or tests.

## Browser display

The portable `@steer/tool-registry/lifecycle-contracts` export contains schemas only,
not registry handlers or providers. The browser uses a fixed same-origin read
endpoint, closed exact-tuple/status/fingerprint validation and a request-owned
display lifetime. Server authorization remains mandatory; a successful JSON parse
is not independent source verification or approval. No body content is returned by
this inventory. Scope, revision, injected authority and malformed responses clear
previous results rather than silently substituting content.

The three status labels are **Available in projection**, **No projection at this
revision** and **Outside configured sources**. These are observations, not red/green
gate indicators, work assignments, readiness claims or an automatic request for access.
No local/session storage or background collection is used. Cancelling or clearing a
check restores focus to the check button. No expired display instance can restart
itself merely because its clock moves backward or later becomes valid.
