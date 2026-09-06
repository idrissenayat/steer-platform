# Spec

## Selected history contract

Accept two through sixteen explicitly pinned native Critic sources, ordered from
initial review to current follow-up. Each selection binds a unique path and digest,
reviewed artifact revision, reviewer provider/task and Builder task. The caller
supplies the item and evaluation instant separately. Sources must be an exact
duplicate-free set matching those selections; their presentation order is irrelevant.

Normalize every original source with the existing strict native Critic validator,
preserving all metadata, findings and HOLD verdicts. The first report must use the
initial findings layout; every later report must use the follow-up layout. Review
times are nondecreasing in exact UTC nanoseconds and cannot be future. Reviewed
revisions may differ or remain identical; no Git ancestry claim is inferred.

Track every inherited finding ID and its initial severity. Each follow-up's
originalFindingStatus must account for the entire preceding inventory, including
resolved findings and findings introduced by earlier follow-ups. No missing,
invented, duplicate or reused ID is accepted. Unresolved partial statuses retain
their original severity; the supported format cannot silently reclassify it.
New finding IDs extend the inventory for the next report. Resolved statuses remain
source claims, not proof of remediation. Changing presentation order is permitted.

All within-record counters and shape checks remain required. Neither zero remaining
findings nor complete linked accounting changes hold-send-back to a pass. This is
not a supported passing Critic profile.

## Git collection

Native Critic startup may select one through fifteen predecessor references in
history; the current report is added by the collector with its existing trusted
selection. Prior paths must not alias current report, policy, build or other
selected sources. Empty or oversized selections and missing identities reject
before I/O. Once configured, absent or invalid history cannot fall back to an
unlinked report.

Read each selected predecessor's original bytes at the same current source head,
using existing organization/repository/path/revision/blob/hash verification. A
report's reviewed revision is distinct from this source-storage revision. No path
in report text chooses additional reads. Each native source is bounded to 512 KiB;
the whole collection retains its 8-MiB budget and fifteen-second deadline.

Expose immutable nativeCriticHistory (null when not configured) beside the current
native observation, with ordered report digests, complete finding IDs and records.
Preserve final head, actor, signer/runner validity, single-flight and shutdown checks.

## Limits

selectedLinksVerified means exact-set continuity for the supplied selection only.
Authoritative initial/history selection, truthful resolution evidence, reviewer
authenticity and target Git ancestry remain separately required. No claim is made
that the selected history includes every real review or that any finding is closed.
gateVerified and writeAuthorized remain false. No protected source or approval is
edited, no real provider is queried, and no frontend or runtime writer is enabled.

