# Brief — Native exception-brief consolidation

## Need

Native domain records now feed the source collector, but their existing consolidated
exception Brief is still unsupported. Its totals and ready/hold labels must not be
trusted independently of the original records, or used to hide resolved findings,
pending escalations, different reviewers or a different source set.

## Outcome

Read the original native exception format unchanged, reconstruct every summary,
finding, escalation and eligibility field from the complete pinned native record
set, and integrate the result into existing policy evaluation. Preserve holds and
the distinction between readiness for Critic review and gate approval.

## Boundary

This is source consistency, not reviewer authentication or accepted gate authority.
No protected sources, reviews or human approvals are changed. All five R5 findings
remain; no new provider access, write, release, deployment or spending is authorized.
