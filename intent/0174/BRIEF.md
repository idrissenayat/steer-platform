# Brief

## Problem

The recorded-Brief workflow has a deterministic starter and fixed authorized worker,
but lacks an owned dispatch/status client. Integrators must recreate cleanup and
uncertain-start recovery, risking a second attempt or mistaking workflow completion
for successful source projection.

## Proposed outcome

An internal client binds one exact operation, admits one explicit start, supports
manual status and drains its owned connection safely. Actual local Temporal tests
exercise lost acknowledgment, reconstruction and retained duplicate refusal.

## Boundaries

No live dispatch, new API/grant, receipt/path admission, authority minting, signed
artifact edit, model use, deployment, spending or real data deletion. All five R5
findings and independent/qualified reviews/human signatures remain open.
