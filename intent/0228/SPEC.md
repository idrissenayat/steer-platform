# Specification

## Command and authority

`POST /v1/tools/intent.development.start` accepts organization, product, repository,
operation UUID/input digest and expected source draft UUID/revision/digest. It is
an explicitly granted human command, separate from `intent.development.read`.
An absent service, wrong owner/scope, expired identity or missing fresh revalidation
fails closed. No source text, profile, queue, credential or claimed approval enters
the request.

The uninstalled SQL composition requires an already admitted operation and an
acknowledged encrypted original. It checks current owner/records/key access, exact
original/source binding, latest draft revision and unexpired execution. Mandatory
`authorizeStart` verifies current source/direction, configuration and execution/
budget authority; it is not supplied by browser data or the tool grant. The actual
source assembly and production authority binding remain unconnected.

The original and operation are rechecked after external authorization. The scheduler
receives only organization, operation UUID, input digest and the retained execution
expiry; only the first three fields enter workflow history. The scheduler calls
the current-authority callback around each remote wait and before dispatch. Workers
retain their existing independent authorization, reservation and dispatch checks.

## Start and recovery

The Temporal adapter fixes namespace and queue in trusted configuration, confirms
the client's namespace and observes registered namespace retention of at least
24 hours. Retained SQL execution authority cannot extend beyond 24 hours, and an
expired operation cannot use this start command. This matters because Temporal's
duplicate-ID policy only covers retained executions. Runtime administration must
not delete/reset workflow history or weaken those controls during active operation
lifetimes; this increment performs no namespace administration.

The adapter first inspects the exact workflow ID. Only a typed absent-workflow
response permits start. Start uses the existing fixed operation ID, FAIL on a
running conflict and REJECT_DUPLICATE for closed runs. A typed duplicate response
leads to readback, not replacement. Other uncertain responses remain unknown.

Before acknowledgement, description and the initial history event must match the
workflow type, queue, run ID shape, eight-minute timeout and exact reference-only
JSON input. Only the first history page is requested; role outputs are not fetched.
An existing same-ID workflow with different input is not acknowledged or replaced.
Closed failed/cancelled/completed workflows are identified honestly, never restarted
by this recovery path. Temporal COMPLETED is not a claim that drafting succeeded.

## Response and lifecycle

The response repeats the entire exact request binding and contains an acknowledged
workflow ID/run ID/state, or an unknown/unavailable receipt. It always says
`documentsReady:false`, `savedToGit:false`, `gateSigned:false` and
`retryAuthorized:false`. Candidate progress/content needs the separate current-
authority read query. These flags grant no authority for model retries or saving.

Permission/source loss after start conceals the acknowledgement without undoing
the workflow or making a second dispatch. Exact reference recovery still needs
fresh permission. Neither service deletes source data or changes draft revisions.

Each service/adapter admits four concurrent requests with a 30-second overall
bound. Temporal RPCs use five-second deadlines. Timed-out pending dependencies keep
their admission until drained; close prevents late effects or content release.
The caller owns the Temporal client/connection. No real runtime binding, migration,
new records key/grant, model usage or Git-saving authority is installed.
