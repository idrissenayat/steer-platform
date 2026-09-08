# Authenticated intent development

Status: integration implemented and tested with synthetic provider responses;
**live activation and real-model acceptance remain open**. Initial integration 0198;
revision-bound source review/direction composition added in 0202.

For the target end-to-end process, see [the blueprint](architecture/END-TO-END.md)
and [workflow contract](architecture/WORKFLOW-CONTRACT.md). They distinguish
candidate drafts from pulled work and formal gates, and propose the durable-state
and protected-publication decisions still needed before those integration paths.
This document below describes the current implementation, not those proposed paths.
The [revision 2 corrections](architecture/REVIEW-FIXES.md) define the target's
final-edited-scope review, contextual retrieval, durable per-step ownership and
manifest-based publication. Increment 0205 implements pure contracts and negative
tests plus editor invalidation, not durable worker, semantic assessment or bundle
save integration. The current synchronous two-role limits below still apply.

0206–0208 add uninstalled bundle reading, configured-item scope collection and
atomic GitHub bundle storage. The store derives the fixed file set, checks exact
draft/consent hashes and predecessor pointers, uses expected-head CAS and verifies
the complete saved commit. Recovery reads the original operation; it never retries
a mutation itself. `not-found` is only a provider observation with retry authority
false, not proof that an uncertain in-flight operation failed. A known local attempt
without a verified receipt stays unknown. After restart the durable owner must
combine provider observation with its original dispatch state.

The required trusted `authorizeAndClaimDispatch` service must verify current
identity/grants, approved gate/policy evidence, actual lifecycle and complete source
assessment at the same expected head, exact human consent, then atomically consume
the operation's single durable dispatch permit. Tests supply a synthetic port;
production composition does not. Lifecycle is never inferred from filenames or
the configured-item collector. Current read authority is required for recovery as
well as saving. See [0208 evidence](../intent/0208/EVIDENCE.md). This is not yet an
enabled save command or a demonstrated user save/reopen journey.

0209 implements a separate, uninstalled PostgreSQL operation/step store. Identical
submissions converge on one immutable operation; claims and cost reservations are
atomic. Only an unambiguously acknowledged first dispatch transition supplies
permission, so a lost response or restarted worker cannot resend it. Expired
pre-dispatch leases may transfer with a new fencing token; sent steps may not.
The Test Agent can reuse the original Architect checkpoint only after exact
persisted-result readback. This metadata adapter is not the result-content store
or the combined `authorizeAndClaimDispatch` authority service. Tests use synthetic
authorization and persisted synthetic checkpoint bytes. Temporal, verified lifecycle/
full-corpus assessment, approved result storage and provider/UI composition remain
next; live model/save authority is unchanged. See [0209 evidence](../intent/0209/EVIDENCE.md).

0210 joins those SQL and Git primitives in the uninstalled
`apps/worker/src/candidate-bundle-runtime.ts`. `prepare` validates exact documents,
consent and configured scope, then allocates/reuses a durable operation; it is not
a save. Its admission digest excludes the not-yet-minted ID but binds the whole
submission and publication profile. The final write-plan/receipt digest includes
the server ID. Caller-selected IDs cannot enter admission, and changed input or
publication authority configuration conflicts with the original operation.

`compareAndWrite` verifies that original operation before provider access; the
writer consumes a SQL claim only after current evidence validation. Only the first
acknowledged dispatch may reach Git. Once SQL records the dispatch boundary,
reconstructed adapters use the read-only receipt path even if the provider says
not-found; that absence becomes unknown, not permission to send again. Exact
original payload and current access are required for recovery. The SQL row remains
at the dispatch boundary after a verified Git observation: separate receipt
checkpoint reconciliation is not installed, and this does not invent a succeeded
job record. See [0210 evidence](../intent/0210/EVIDENCE.md).

The trusted current-authority/lifecycle/full-corpus ports are still missing in the
actual application, as are approved original-payload storage, Temporal binding and
UI save/reopen. There is no automatic publication, real account call or new grant.

0211 adds the uninstalled candidate-save Temporal path. A trusted internal client
starts one deterministic workflow for an admitted operation; its input contains
only organization, operation ID and final write digest. A dedicated fixed-operation
activity reauthorizes, loads the exact original request through a required trusted
port, recomputes its plan/hash, then calls 0210's durable store. Payloads, credentials,
consent and authority proof objects never enter workflow arguments or heartbeats.
The result contains only operation/digest, outcome and an optional saved revision.

There are no automatic activity or workflow retries. Retained workflow IDs reject
duplicate starts, but the SQL dispatch boundary remains the cross-process safety
control. Missing/stale payloads fail instead of being regenerated. Five-second
authority/load limits and cancellation prevent late reads from starting a save;
heartbeat cancellation closes the bound writer. Cancellation after an accepted Git
effect cannot undo it or permit a new send. A workflow may complete with `unknown`:
only a verified `committed` observation means saved, and neither is a gate signature.
The SQL row still requires separate receipt checkpoint reconciliation.

See [0211 evidence](../intent/0211/EVIDENCE.md). This is not application startup,
approved original-payload persistence, a public scheduling command or a working
user-facing save button. Durable Architect/Test Agent activities and actual
lifecycle/full-corpus/authority services remain separate integration tasks.

0212 adds a separate `reconcile(originalRequest)` command on the uninstalled
candidate store. Ordinary read access and `inspect` still do not modify the SQL
step: the composition must supply an explicit current `authorizeReconciliation`
service as well as current operation/read authority. The method re-verifies the
native Git receipt and full saved bundle, then stores only an exact result digest
and operation-scoped receipt reference as the step's succeeded checkpoint. The
provider read finishes before SQL begins; a five-second, in-process immutable
evidence binding is consumed by the checkpoint verifier, never caller assertions.

Repeated reconciliation re-verifies Git and returns the same checkpoint. Lost SQL
commit acknowledgement returns unknown even when success persisted; retrying this
explicit read/reconciliation path never retries the Git write. A missing/corrupt
receipt, closed/revoked service, stale evidence or manually quarantined/known-failed
step cannot be promoted. `recorded` means this checkpoint was acknowledged, not a
gate approval or new execution permission. Neither the UI nor 0211's workflow
invokes reconciliation automatically. See [0212 evidence](../intent/0212/EVIDENCE.md).

## Human journey

Open https://localhost:8443/ and sign in. The actual workspace now starts with
one free-text intent composer, not eight intake questions or a separate local
preview. Manual Brief tools remain collapsed below it. Previously saved browser
records are not deleted, migrated, promoted to Git or sent to a model.

Before sending, check existing scope and explicitly confirm a direction and reason.
Added clarification invalidates the previous review: search uses the original text
plus the exact clarification. When explicitly activated, **Review my intent** sends the source and proposal to the authenticated
`intent.agent.develop` command. The Architect either asks up to three necessary
questions or drafts a candidate Brief and Spec. A fresh-context Test Agent receives
only the original source/clarification, human direction, server-retrieved scope
evidence and those candidates, then authors an Exam
marked NOT RUN. The UI displays all three documents for review. It does not report
a save, signature, executed test or implementation.

0204 adds editable copies alongside the untouched generated originals and original
source. Switch documents without overwriting corrections, or inspect the original
without resetting edits. Empty drafts show a warning. Human corrections are not
independent Test Agent acceptance; no review or model call is automatically rerun.
Original source/direction are locked while reviewing a bundle to prevent accidental
replacement. Durable versioned drafts and safe regeneration remain pending.

0205 labels the initial source check as historical once a bundle is generated:
generated Brief/Spec scope needs its own review. Every local correction advances a
draft revision; Brief/Spec changes invalidate scope/direction, Spec conformance,
Exam applicability and save consent. Exam-only changes invalidate Exam review and
save consent without pretending the Brief/Spec changed. Undo does not restore old
confirmation. The editor explicitly says final-scope review is not connected yet;
typing starts no model, search or save call. Earlier source evidence and reasons
remain visible as historical reference, and generated originals remain untouched.

The non-billable contracts in [0205 evidence](../intent/0205/EVIDENCE.md) prepare exact
scope/save bindings, bounded whole-document evidence, step transition plans and
candidate file manifests. These do not change the current lexical query, supply
semantic judgments, persist an operation or perform a Git write. An evidence
validator can check citations and declared coverage, not whether a model understood
the source. Only unreviewed/stale Spec and Exam states are supported by the current
candidate planner; independent publication/promotion remains a separate action.

0206 adds an uninstalled bundle/pointer reader using the same manifest contracts.
It verifies exact historical bytes without following latest pointers and rejects
corrupt or missing sources; [evidence](../intent/0206/EVIDENCE.md) uses native Git
with synthetic provider responses. This does not add a save/reopen control to the
current UI or configure access to real candidate bundles.

0207 adds an uninstalled same-commit source collector for configured item homes.
It follows current candidate/amendment pointers and exposes root Brief/Spec scope
separately, with explicit coverage gaps; [evidence](../intent/0207/EVIDENCE.md) does
not claim verified lifecycle selection or full-corpus coverage. The live lexical
tool and manual conversation choreography are unchanged.

The current delivery is a bounded request/response workflow, not streaming, voice,
a durable conversation, Temporal orchestration or a completed Gate 2 workflow.
The source is limited to 10,000 characters, clarification to 3,000, and the encoded
request to 16 KiB. The page explains that refreshing or hiding it clears the
conversation. Do not enter sensitive source while evaluating the new interaction.

## Implementation

- `packages/tool-registry/src/agent-contracts.ts`: portable input/output and service
  contracts. The registry exposes a **command**, not a read-preview query, to the
  existing HTTP, internal and MCP discovery paths.
- Exact organization, human identity and `intent.agent.develop` grant required.
  The same current identity must also hold `intent.overlap.check`,
  `intent.brief.catalog`, `intent.brief.read` and `projection.artifact.read`, and
  a curated projection reader must be configured. Browser fingerprints are not
  trusted evidence: the server reads actual projections before generation and
  after it, comparing the proposal's input/catalog/review fingerprints and target
  Brief revision/digest. Stale scope returns 409 without a draft response. Changes
  detected after generation can consume budget; they are not automatically retried.
  Existing Brief-preview permission cannot authorize model usage. Revalidate before
  and after I/O, including between the Architect and Test Agent calls.
- `packages/agents`: provider-free coordinator plus an isolated Mastra runtime
  adapter. Mastra 1.64.0 and the OpenAI-compatible adapter 3.0.44 are pinned.
  Structured outputs use the installed SDK's `strict` error strategy, not invented
  fallback documents. No automatic retries, model fallbacks, memory or tools.
- ADR-06 is preserved: only an explicitly configured **local LiteLLM** endpoint is
  accepted. The OpenAI secret belongs in that gateway, never the browser or API's
  gateway-key slot. Direct OpenAI/provider URLs and credential-bearing redirects
  are rejected. Provider response storage is disabled. Agent and structured-output
  logging are no-op; telemetry content recording is disabled. Raw gateway responses
  are limited to 1 MiB before the SDK parses them.
- API composition accepts an explicit server-owned `modelGateway` dependency with
  configuration revision, gateway options and a `DevelopmentPermit`. Construction
  makes no model calls. The permit must atomically reserve the worst-case configured
  cost **before every call**, including the independent Exam call. Failures/timeouts
  consume their reservations; they must not refund an uncertain provider outcome.
- Browser command transport uses HTTPS, same-origin cookies, no-store, no redirects,
  bounded payloads/responses and no automatic retry. Responses are rendered as inert
  Markdown; remote images, active source links and raw HTML are not executed.

## Activation remains closed

Creating an API key did not authorize model spending. The current local launcher
does not bind a model gateway or budget permit, and `STEER_WEB_INTENT_AGENT` is not
enabled. The new command also needs a separate Git-backed tool grant; no grant was
added by this implementation. The UI reports setup pending instead of simulating
an agent response.

Before a live test:

1. Obtain the user's explicit test-session model budget. The infrastructure ceiling
   and API-key creation permission are not that authorization.
2. Configure the local LiteLLM gateway with the protected OpenAI key, a pinned
   model/configuration, bounded token settings and gateway virtual credential.
   Implement and verify the durable, atomic budget-reservation binding for the
   approved session and conservative per-call upper bound. The coordinator's port
   now has a PostgreSQL-tested adapter in `@steer/data/model-budget` (0203), but no
   real budget row or local binding is installed. Independently verify spending
   approval and all worst-case token/pricing bounds before provisioning it.
3. Bind curated source projections and explicitly scoped read grants as above,
   bind `modelGateway` at local API startup and configure the UI display flag.
   Authorize drafting for the intended human at the current prompt/configuration
   revision. This does not grant
   signing, provider administration, code-host writes or deployment authority.
4. Run the real signed-in UI journey with non-sensitive source; inspect actual
   model output, clarification quality, independent Exam coverage, refusal/failure
   behavior, cost accounting and provider configuration. Synthetic tests do not
   establish real-model quality or privacy/retention acceptance.
5. Connect reviewed candidates to separately authorized durable Git saving and
   projections. Preserve immutable source revisions and the protected canonical Exam
   boundary. Do not write generated Exam text over `intent/0001/EXAM.md`.

These pending tasks are not completed merely by a successful build. OpenTelemetry
content-free model spans, canonical template/eval coverage, durable conversation,
streaming, voice and real end-to-end Git saving remain follow-through work.

## Sources and verification

The pinned installed Mastra declarations were checked alongside the official
[structured-output guide](https://mastra.ai/docs/agents/structured-output).
The adapter is tested through the real Mastra library using a fake HTTP transport,
not a substituted agent UI. See [0198 evidence](../intent/0198/EVIDENCE.md).
