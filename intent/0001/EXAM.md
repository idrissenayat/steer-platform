# Gate 2 Exam candidate: Flight Deck Phase 1 production foundation

Item: `0001-flight-deck-foundation`

Author accountability: independent Test Agent

Status: **unsigned Gate 2 candidate; exact-revision Critic review required**

## Revision and source binding

This Exam is derived from and cannot weaken the Gate 1 artifact set accepted at
Git commit `281c9736816ec22fa1209b060b58fa8164519f7c`:

- `intent/0001/BRIEF.md`
- `intent/0001/SPEC.md`
- `intent/0001/ARCHITECTURE.md`, document revision 2
- `intent/0001/PLAN.md`

The detached Gate 1 record is `signatures/gate-1.json`. The supplied predecessor
Exam is preserved byte-for-byte at `sources/EXAM.supplied.md`, SHA-256
`5823ddb26d0acbc78b7b58d931d76adfe064adeba84b9cf81fad2557d528eb7b`.
Cases `OR-01` through `OR-25` below incorporate all of that supplied Exam's
acceptance requirements. Cases `WS-01` through `WS-13` incorporate all thirteen
Architecture revision 2 walking-skeleton cases.

The **Exam revision** is the full 40-character Git commit containing this file.
A Critic review, domain-agent review, human-exception record, test run, evidence manifest, or signature is
current only when its `artifactRevision` equals that exact commit. A branch,
short hash, working-tree hash, later commit, or Gate 1 revision is not a valid
substitute. Any change to this file creates a new Exam revision and invalidates
prior Gate 2 reviews, evidence, and signatures for the candidate.

Builders may not edit an Exam. Repository CI enforces GitHub actor allowlisting
for every `EXAM.md` diff; local hooks are advisory defense in depth. An agent may
author or test this Exam when independently assigned, but no agent may sign any
gate or specialist approval.

## Scope-writability and verdicts

This Exam proves one coherent outcome: the integrated Phase 1 production
foundation described by Architecture revision 2 is tenant-safe, durable,
portable, accessible, operable by humans and agents through one authorization
path, and capable of producing the Brief's real pilot evidence.

There are three deliberately separate decisions:

1. **Gate 2 Exam accepted** means a passing exact-revision fresh-context Critic,
   zero unresolved findings, current green independent agent reviews for every
   activated domain, one consolidated exception brief, resolution of every
   triggered human escalation, and the required human Tech Lead signature accept
   this definition of done. It is not build, release, spending, or production
   authorization.
2. **Technical release candidate** means every technical case in this Exam is
   green at one exact implementation revision, its evidence is current, every
   activated-domain release review is current, every human escalation trigger is
   resolved, and Gate 3 is otherwise eligible.
   A named human release authorization is still required before production.
3. **Outcome complete** means the released candidate has processed at least ten
   real pilot items and the complete 90-day outcome contract passes. Fixture,
   demo, synthetic, replay, or test data never counts as pilot evidence.

The Phase 1 architecture may be called complete only when both verdicts 2 and 3
are true. A working UI, component tests, or verdict 2 alone is not outcome
completion.

## Reproducibility contract

Before a technical run, the implementation must commit a versioned testkit
manifest for this item. The manifest and every result are retained under
`evidence/0001/<exam-revision>/<implementation-revision>/<run-id>/` or in an
immutable tenant-scoped evidence object whose Git reference records the same
logical path, SHA-256 hash, media type, size, producer, and revisions.

### Frozen inputs

- Fixture manifest: `packages/testkit/fixtures/intent-0001/manifest.v1.json`.
  It lists every fixture and corpus by repository-relative path, byte length,
  SHA-256, schema version, and classification (`synthetic`, `sanitized-real`, or
  `pilot-real`). Missing, extra, or hash-mismatched inputs fail the run.
- Pseudorandom generation uses the UTF-8 seed `steer-0001-exam-v1`, the
  `xoshiro256**` algorithm, and the manifest-recorded generator version. Each
  property case records the derived sub-seed and shrink result.
- The state matrix exhausts every valid combination declared in
  `artifact-chain-states.v1.json`: artifacts present, required signatures
  present or absent, checks green or red, active profile, domain set, and
  current or stale revision. Invalid combinations are enumerated separately and
  must fail closed.
- The originator corpus contains exactly 20 sanitized real prompts in
  `originator-corpus.v1.jsonl`. The manifest freezes order and hashes. Its
  accepted baseline is `originator-baseline.v1.json`, bound to the prompt,
  template, model/configuration, tool registry, and evaluator revisions.
- Canary values, webhook vectors, identity claims, tenant topology, timestamps,
  dropped-event positions, storage roots, and expected outputs are manifest
  entries, not values chosen during a run.

### Canonical comparison

- JSON uses RFC 8785 JSON Canonicalization Scheme encoded as UTF-8.
- Markdown and text use UTF-8 without BOM, LF line endings, Unicode NFC, and no
  trailing whitespace; final-newline presence is significant.
- Collections are sorted only by the explicit schema key. Unordered database
  rows are sorted by `(organization_id, repository, item_id, record_type,
  logical_id)` before canonicalization.
- User-visible rebuild equality compares an accessibility-tree/semantic-view
  snapshot containing routes, headings, labels, roles, values, states, and
  ordered content. Volatile request IDs, trace IDs, and wall-clock display are
  represented by schema-declared deterministic tokens. A raw DOM screenshot is
  supplementary, not the equality oracle.
- Byte equality means equal SHA-256 over the canonical bytes. Both pre-wipe and
  post-rebuild bytes and hashes are retained.

### Clocks, environment, repetitions, and percentiles

- Functional time-dependent cases use a manifest-seeded virtual UTC clock.
  Security expiry cases additionally run against a real UTC clock with maximum
  permitted skew recorded in the run manifest.
- Latency uses a monotonic clock on the measured host. Cross-service spans use
  OpenTelemetry timestamps synchronized by the integration environment; the run
  records observed clock offset and fails if absolute offset exceeds 50 ms.
- The reference integration environment is a clean Linux `x86_64` runner with
  4 dedicated vCPU, 16 GiB RAM, local SSD, Node/pnpm and container digests from
  the stack lock, production builds, telemetry enabled, and no fixture service
  mocks in the measured path. CPU model, kernel, load, memory, region, network
  path, database size, and every digest are recorded.
- Unless a case gives a stronger rule, deterministic cases run once after a
  clean reset and property cases run 10,000 generated examples. Performance
  cases use 30 unrecorded warmups followed by 200 recorded observations in each
  of three independently reset runs.
- `p95` is the nearest-rank value: sort all `N` observations ascending and take
  rank `ceil(0.95 * N)`, one-indexed. Each of the three runs must independently
  meet the threshold; pooled percentiles may be reported but cannot mask a bad
  run. Timeouts, cancellations, and missing samples are failures, not discarded
  outliers.

### Required evidence outputs

Every run writes canonical `run-manifest.json`, `case-results.json`,
`side-effects.jsonl`, `environment.json`, `input-manifest.json`,
`metrics.json`, `trace-index.json`, and `artifact-hashes.json`. Applicable cases
also retain sanitized logs, JUnit/coverage, axe results, semantic snapshots,
authorization decisions, database/RLS plans, object-store listings, workflow
histories, Git/code-host records, screenshots, and signed manual review records.
Each case result names its inputs, clocks, seed, repetitions, actual threshold,
evidence references, implementation revision, and Exam revision. A missing or
stale required output fails the case.

The side-effect ledger records every attempted and completed Git/code-host
write, database mutation, object write, cache mutation, workflow signal/start,
model-key access, sandbox action, notification, and external spend request.
Negative cases pass only when the expected denial is present and the ledger
contains no prohibited side effect.

## Supplied Exam cases

### Authority, projection, and decision correctness

**OR-01 — Complete board-state matrix (supplied 1).** Given the frozen state
matrix, the projected Flight Board state equals the expected state for every
valid item combination; every invalid combination is rejected and produces no
authoritative write.

**OR-02 — Destroy and rebuild (supplied 2).** Given a completed deterministic
session, capture canonical projections and semantic views, destroy every
Postgres projection, replay only authoritative Git/code-host records and the
append-only ingestion source, and prove byte-identical hashes. Private database,
cache, search, workflow, or analytics state may not be used as repair authority.

**OR-03 — Full storage crawl (supplied 3).** After the complete session, crawl
all Git repositories, Postgres schemas/tables, full-text and vector indexes,
object-store buckets/versions, Temporal workflow state, caches, model gateway,
sandbox volumes, analytics, logs, traces, and local/container filesystems. The
crawl must find no authoritative item status or approval outside the chain.
Mirrors are permitted only when they contain a current chain reference and can
be destroyed and rebuilt. Retain the crawl inventory and allow/deny rationale.

**OR-04 — Decision-card authorization matrix (supplied 4).** Across all frozen
subjects, active hats, profiles, domain sets, gate states, revisions, and prior
signatures, a card appears if and only if the gate is ready, the verified human
holds the required active hat, all conditional seats route correctly, and the
gate is unsigned for that sequence.

**OR-05 — Exact-revision signature (supplied 5).** A valid click records the
complete envelope defined below against the displayed revision. Mutate the
artifact after render and before click: authorization rejects the stale action,
writes no signature or mirror, records the denial, and re-presents the card at
the new revision.

**OR-06 — Send-back (supplied 6).** A send-back writes the note to the correct
chain location, projects the correct state, leaves the gate unsigned, emits no
approval mirror, and is idempotent under retry.

**OR-07 — Domain assurance routing and SLA (supplied 7).** Every activated
domain routes one current fresh-context review to an independent domain agent;
inapplicable domains route none. A human specialist card appears only when a
deterministic commercial escalation trigger fires or the regulated profile
requires it. Using virtual time, cross each configured deadline and prove visible
escalation appears within 60 real-time seconds without creating an approval or
release authorization.

**OR-08 — Gate 3 evidence view (supplied 8).** For the displayed implementation
revision, the card contains every Exam case result, ranked Critic findings with
the nit cap, plan conformance, domain-agent reviews, the consolidated exception
brief, triggered human dispositions, evidence hashes, and verdict.
Missing, unavailable, hash-mismatched, wrong-tenant, or older-revision evidence
renders explicitly non-current and blocks eligibility.

### Originator, backlog, and attention behavior

**OR-09 — Originator flow (supplied 9).** A scripted non-engineer session from
problem description through corrections and save produces a template-valid
`BRIEF.md` attributed to the verified originator. Every visible state passes the
frozen banned-term corpus with no Git or Markdown terminology.

**OR-10 — Originator assistant regression (supplied 10).** Run each of the 20
frozen prompts three times with the model snapshot/configuration, system prompt,
template, tools, locale, temperature `0`, and maximum tokens pinned. All 60
drafts contain problem, proposed outcome, affected users/systems, constraints,
and open questions; every system name resolves to supplied context; hallucinated
systems equal zero. Per-field and total pass rates may not fall below the frozen
baseline. Any prompt/template/model/tool change forces the complete suite and a
new baseline may replace the old one only through its own reviewed evidence.

**OR-11 — WIP refusal (supplied 9a).** At and above each personal WIP limit
across pods and hats, pull is refused, the limit is visible, the denial is
logged, and no item, workflow, notification, or authoritative write is created.

**OR-12 — Measurement state (supplied 9b).** The badge is `measurable` if and
only if the metric and denominator resolve against the connected production
telemetry registry. It is `greenfield` only under the explicit leading-indicator
rule and `unresolved` otherwise. Synthetic or fixture telemetry cannot make it
measurable.

**OR-13 — Duplicate clustering (supplied 9c).** With the frozen corpus and seed,
all declared near-duplicates form the expected clusters and unrelated intents
never join them across 10,000 generated perturbations. Retain cluster membership,
scores, threshold, model/configuration revision, and minimal failing shrink.

**OR-14 — Decay without deletion (supplied 9d).** Advance virtual time across
every boundary and prove untouched intents expire with original and expiry
timestamps, are never deleted, and reappear only from a newly attributed signal.

**OR-15 — Decline feedback and cooldown (supplied 9e).** Decline records its
reason, exposes it to Scout tuning input, and suppresses re-notification for the
exact configured cooldown. Boundary instants and retries are deterministic.

**OR-16 — Protected attention (supplied 9f).** With all panes populated, semantic
order is decision inbox, triggered candidates, ambient flight. Capture all
notifications and prove ambient flight emits none except a declared band breach.

### Security, privacy, accessibility, performance, and operability

**OR-17 — Least privilege (supplied 11).** Code-host, workflow, model, evidence,
sandbox, analytics, and CI tokens have only the contract-declared read and
approval-write capabilities. The scope audit fails on each frozen broader-scope
mutation and retains the evaluated permission set.

**OR-18 — Content-free observability (supplied 12).** Seed unique canaries for
secrets, tokens, originator text, artifact content, tenant identifiers forbidden
by policy, and model inputs. Crawl application/container logs, traces, metrics,
analytics, exception reports, workflow histories, and CI output. No canary may
appear; redaction itself must not leak prefixes or reversible encodings.

**OR-19 — Webhook authenticity and replay (supplied 13).** Valid signed vectors
project once. Forged, altered, expired, cross-tenant, and replayed vectors are
rejected with stable errors and zero prohibited side effects. Retain request
hashes, signature metadata without secrets, decisions, and ledger entries.

**OR-20 — Originator retention (supplied 14).** Before save, originator text
exists only in the declared session boundary. After save or abandonment, crawl
all stores named by OR-03 and prove it exists only in the committed artifact when
saved, or nowhere when abandoned, subject to the signed retention policy.

**OR-21 — Automated accessibility (supplied 15).** Run axe-core on every route
and Storybook state at required desktop and mobile viewports. Critical and
serious violations equal zero. The route/state/viewport inventory is frozen in
the input manifest; omissions fail.

**OR-22 — Manual accessibility (supplied 16).** Before a user-facing technical
release, a human accessibility specialist completes the full keyboard-only
decision flow and screen-reader passes for Gate and escalation cards against the
versioned 81-checkpoint model. This is a release-validation trigger, not a
routine Gate 2 domain seat. The signed record names assistive
technology/browser/OS versions, findings, implementation revision, and Exam
revision. Any unresolved critical or serious issue fails.

**OR-23 — Decision-inbox render (supplied 17).** Load exactly 50 pending
decisions across 10 repositories using the frozen fixture in the reference
environment. Measure navigation/request start through semantic ready state using
the stated warmups/repetitions/nearest-rank method. Each run must have p95 at or
below 2,000 ms; retain raw observations and traces.

**OR-24 — Projection and reconciliation latency (supplied 18).** For each of
three independent runs, ingest 2,000 manifest-ordered events and deterministically
drop exactly 100 positions (5%). Non-dropped event-to-semantic-board latency must
have p95 at or below 60,000 ms. From the monotonic timestamp of each dropped
event's source availability, reconciliation must restore every expected board
state within 600,000 ms wall-clock. Retain raw timestamps, offsets, drop list,
traces, and pre/post hashes; a missing sample fails.

**OR-25 — Self-hosted core (supplied 19).** From a clean checkout and pinned
container digests, start the regulated-profile core with outbound network denied
except manifest-declared local service endpoints. Run OR-01 through OR-24 cases
that touch the core. No undeclared SaaS dependency, hidden credential, or remote
control-plane call is permitted.

## Architecture revision 2 walking skeleton

Each case is an end-to-end production-path case. Component mocks may stimulate
an external boundary only when the adapter contract is itself under test; they
cannot replace the integrated path.

**WS-01 — Interview and render.** Interview a frozen natural-language intent and
render the corrected draft through the production conversation and UI path,
meeting OR-09 and OR-10.

**WS-02 — Originator GitHub commit.** Save through the GitHub App adapter under
the verified originator identity. Prove exact repository/tenant routing,
idempotency under retry, least privilege, and an authoritative commit containing
the accepted bytes; no database-first success is permitted.

**WS-03 — Correct projections.** From that code-host event, project the intent
into exactly the expected backlog, Flight Board, and authorized decision inbox.
Prove OR-01, OR-04, and negative tenant isolation for all three views.

**WS-04 — Complete human signature.** Record a verified human signature with all
nine envelope fields through the production authorization and Git path. Run the
entire signature-negative matrix; agents and stale requests always fail closed.

**WS-05 — Durable Gate wait.** Enter a Gate wait, record workflow identity and
timer state, terminate and replace the Temporal worker, and prove the same item,
history, timer, and idempotency key resume with no duplicate workflow or write.

**WS-06 — Configuration-only model swap.** Call the frozen prompt through
LiteLLM with model configuration A, change only the pinned configuration revision
to compatible model B, and call again. Domain, tool, workflow, and API code hashes
must be unchanged; evals and budget/tenant routing pass for both configurations.

**WS-07 — MCP/UI authorization parity.** Invoke one query and one write through
MCP v2 Streamable HTTP and through the UI API for the same human and agent
principals. Decisions, errors, tenant scope, idempotency, and audit metadata are
canonical-equal. Stdio is not used for the remote case.

**WS-08 — Readiness to on-ramp Brief.** Run the selected Stack Pack's five-part
readiness scan inside a fresh ephemeral sandbox with scoped credentials. A frozen
finding creates one attributed draft on-ramp Brief through standard intake;
retry creates no duplicate and dispatches no Builder.

**WS-09 — Immutable tenant evidence.** Store evidence in the tenant bucket,
commit its full content-hash reference to Git, retrieve and verify the bytes, and
prove mutation is refused. Cross-tenant list, head, get, presign, overwrite, and
reference use all fail per the isolation matrix.

**WS-10 — Agent-first topology with one confirmation.** Through the production
platform-agent conversation, propose organization, portfolio, product, pod,
hats, registered agent, specialist pool, Stack Pack, operating/home repositories,
product brief, mission brief, and first intents. Before confirmation there are no
structural writes; one verified human confirmation writes the declared topology
through registered tools. The agent does not sign.

**WS-11 — Cross-tenant refusal.** Execute every row in the cross-tenant matrix
at API, database, search, evidence, model-key, workflow, cache, sandbox, memory,
and observability boundaries. All results fail closed without existence or
timing oracles and with zero prohibited side effects.

**WS-12 — Gate 3 second look.** Under the current commercial/default-closed
profile, attempt Gate 3 in the Gate 2 session and before the build Critic report;
both fail with no signature. After a passing exact-revision build Critic report,
open a new authenticated session and complete all required human Gate 3 seats;
only that sequence is eligible.

**WS-13 — Identical reconstruction.** Destroy Postgres projections, full-text
and vector indexes, caches, and repairable workflow projections, then reconstruct
from Git/code-host authority and the append-only ingestion source. OR-02 canonical
hashes and the user-visible semantic state must be identical for every tenant.

## Signature envelope and negative matrix

Every gate and triggered human-specialist signature record must contain all
fields below:

| Field | Required value and source |
|---|---|
| `organization` | normalized organization from the verified session, equal to the item's tenant |
| `subject` | stable verified human OIDC subject; never a display name or service identity |
| `activeHat` | one currently assigned human hat used for this decision |
| `gate` | exact gate or triggered named specialist seat being decided |
| `sequence` | expected positive integer position for that gate/seat |
| `artifactRevision` | exact 40-character revision displayed and authorized |
| `sessionId` | authenticated, non-empty session identifier bound server-side to the subject |
| `decision` | enum `approved`, `declined`, or `send-back` as allowed by the seat |
| `timestamp` | server-issued UTC RFC 3339 timestamp after authorization and before the Git write |

Every rejection below must have a stable denial reason, an audit event containing
no prohibited content, and zero signature, approval mirror, workflow advance, or
release side effect.

| ID | Negative or policy case | Required result |
|---|---|---|
| SIG-01 | any one envelope field missing, null, duplicated, malformed, or unknown | reject |
| SIG-02 | organization differs from item, repository, session, or evidence tenant | reject without revealing existence |
| SIG-03 | subject is unverified, disabled, transferred, or not bound to the session | reject |
| SIG-04 | requested hat is inactive, wrong for the gate/domain, or asserted by the browser | reject |
| SIG-05 | gate or sequence differs from the next eligible seat | reject; no skipped or duplicate sequence |
| SIG-06 | artifact revision is short, absent, stale, nonexistent, cross-repository, or not the displayed revision | reject and re-present current revision |
| SIG-07 | session is expired, revoked, empty, or violates the second-look rule | reject |
| SIG-08 | decision is unknown or disallowed for the seat; timestamp is client-issued, future, expired, or precedes prerequisites | reject |
| SIG-09 | principal is an agent/service identity, including one with a human display name or copied human claims | reject always; agents never sign |
| SIG-10 | code-host write fails, conflicts, or times out | no local/mirror approval; retry is idempotent |
| SIG-11 | commercial default-open | require one eligible human and a passing exact-revision fresh-context Critic |
| SIG-12 | commercial default-closed, including this item | require one eligible human per gate, current green independent domain-agent reviews, one consolidated exception brief, resolution of every triggered specialist seat, a passing exact-revision Critic with zero unresolved findings, and Gate 3 only in session(s) distinct from every Gate 2 signature session after the build Critic report |
| SIG-13 | regulated default-open | require one eligible human and a passing exact-revision fresh-context Critic |
| SIG-14 | regulated default-closed | require two distinct verified human subjects; two hats or sessions held by one subject do not satisfy it; Critic must pass with zero unresolved and onboarding must have disclosed the constraint |
| SIG-15 | user-facing Gate 3 | require Product Lead and Tech Lead plus Product Designer; each envelope independently passes this matrix |

Gate 2 for this Exam requires a human Tech Lead signature over the consolidated
exception brief. Independent domain-agent reviews are evidence, not signatures.
Human domain-specialist signatures are conditional exception seats, not routine
reviews and not substitutes for the gate owner. The current commercial solo
profile permits one qualified human to hold multiple eligible hats, but each
signature still names one active hat. No Gate 2 signature is created by this
candidate.

## Cross-tenant negative matrix

Use tenants A and B with indistinguishable topology and frozen canaries. For each
row, exercise read, list/search, create, update, delete/expire, retry, and indirect
reference variants that the boundary exposes. Repeat with a human, registered
agent, revoked agent, background worker, and administrator from the wrong tenant.

| Boundary | Required negative probes | Required result and evidence |
|---|---|---|
| API and UI/BFF | IDs, routes, pagination cursors, export, tool calls, websocket/stream reconnect | policy-equivalent not-found/denial, no payload or timing oracle, no write |
| Postgres direct and pooled | every tenant table, transaction-local context, connection reuse, prepared statements, jobs | RLS denial/zero rows; tenant context cleared on reuse; plans and audit retained |
| Full-text search | exact canary, prefix, typo, facet, count, snippet, pagination | no hit, count, snippet, facet, or existence leak |
| pgvector and memory | nearest neighbor, filtered/unfiltered query, prompt retrieval, episodic recall | no cross-tenant candidate before ranking; no canary in model context |
| Evidence/object storage | list, head, get, range, presign, hash reference, overwrite, delete/version | deny without metadata; no URL/object mutation; access log retained |
| Model gateway and keys | key selection, fallback, budget lookup, cached response, error path | never select/use tenant B key, budget, prompt, cache, or response |
| Temporal workflows | start, signal, query, cancel, reset, reused workflow ID, worker recovery | tenant-derived ID/policy denies; no history disclosure or mutation |
| Cache and sessions | direct key, guessed key, eviction, shared cache, cookie/token swap | namespaced miss/deny; no tenant B value or invalidation |
| Sandbox and readiness | mount, checkout, secret, network, artifact, cleanup/reuse | no B repo/key/artifact/network access; ephemeral state destroyed |
| Logs, traces, metrics, analytics | queries, dashboards, exemplars, error aggregation, exports | tenant-scoped result; no content/canary/cardinality leak |
| Notifications | recipient lookup, deep link, retry, template error | no B recipient/content/link; no send side effect |
| Git/code-host adapter | repository lookup, branch/ref, commit, review/status, signature, idempotency key | deny before token exchange/write; no repository-existence leak |

The matrix passes only if authorization decisions and the side-effect ledger
agree. Application-layer filtering alone cannot compensate for failed RLS or a
cross-tenant object/workflow/key boundary.

## Default-closed domain activation and routing

The signed Brief's domain-tag bytes remain unchanged. This Exam conservatively
activates every default-closed domain implicated by the accepted Brief, Spec,
Architecture, and Gate 1 rulings; this is enforcement of accepted scope, not a
new feature request. Removing an activated domain or changing the signed Brief
tags requires a revised Brief and a new Gate 1.

| Domain | Status and accepted-scope trigger | Required independent review and human trigger |
|---|---|---|
| security | activated: identity, authorization, webhooks, tokens, secrets, sandboxes | independent security agent reviews OR-17/19, WS-02/04/07/08/11 and SIG matrix; human only for an unresolved major/blocker, inconclusive evidence, waiver, binding requirement, or material external effect |
| privacy | activated: originator text, tenant data, logs, analytics, model context, memory | independent privacy agent reviews OR-03/10/18/20 and the isolation matrix; human only for an unresolved major/blocker, inconclusive evidence, waiver, binding requirement, or material rights impact |
| accessibility | activated: user-facing decision, escalation, conversation, and board surfaces | independent accessibility agent reviews OR-21 and the OR-22 evidence design; human manual OR-22 validation is required before user-facing technical release |
| money | activated: model/pod budgets, external services, and Gate 1 no-spend boundary | independent money agent reviews budget isolation and authorization controls; human approval is required for production, paid deployment, or spend, and a ceiling is never authorization |
| legal | activated: authenticated approvals, audit weight, retention, and regulated-signature constraint | independent legal agent reviews signature form, records, retention, and the signed-log prerequisite; human only when law, regulation, contract, policy, waiver, or material rights require judgment |
| reliability | activated: Temporal waits, reconciliation, rebuild, latency, recovery, and portable deployment | independent reliability agent reviews OR-02/23/24/25 and WS-05/13 with raw measurements; human only for an unresolved major/blocker, inconclusive evidence, waiver, or binding requirement |
| irreversible-operations | activated: authoritative commits, signatures, release records, migrations, and evidence retention | independent irreversible-operations agent reviews stale/retry/rollback/forward-only behavior and named authorization boundaries; human approval is required for irreversible external effects and production/spend actions |

For Gate 2, each domain-agent review record must name the domain, reviewer
identity and configuration, fresh-context and Builder-independence assertions,
disposition, confidence, timestamp, exact Exam revision, reviewed cases,
evidence hashes, findings, and every applicable escalation trigger. The platform
rejects stale, missing, self-reviewed, or inconclusive records and consolidates
the current records into one exception brief. A triggered human escalation is a
separate signed record; the agent cannot suppress it, waive a control, sign for
the human, or convert missing evidence into a pass. For technical release, each
domain requires a release review bound to both the exact Exam and implementation
revisions. One qualified human may fill more than one commercial exception seat
only when each hat assignment is explicit.

## Technical-release verdict

`technical-release-candidate` is true only when:

1. OR-01 through OR-25, WS-01 through WS-13, every SIG row, and every
   cross-tenant row pass at one exact implementation revision.
2. Required evidence outputs are present, hash-valid, tenant-correct, and bound
   to the exact Exam and implementation revisions.
3. A fresh-context build Critic reports pass with zero unresolved findings at
   those revisions.
4. Every activated-domain agent review is current and green, the consolidated
   exception brief is complete, and every triggered human-specialist record is
   signed by an eligible human and current to those revisions.
5. Gate 3 signer eligibility, including the commercial separate-session second
   look and the Product Designer seat for this user-facing change, is proven.
6. The release record states that paid deployment and production remain blocked
   without a separate named authorization. No result here authorizes spending.

A failed, missing, unavailable, stale, wrong-tenant, or inconclusive case is a
failure. Waivers, reruns that discard failures, and aggregate scores cannot turn
a required case green.

## Pilot and 90-day outcome verdict

The pilot activation instant `T0`, pod, candidate release revision, baseline
window, telemetry contract revision, and production-data classification policy
must be signed before measurement. The baseline is the contiguous 90-day UTC
window immediately before `T0`; the outcome window is `[T0, T0 + 90 days)`.
If the pilot lacks a valid baseline for a metric, outcome completion is blocked
rather than inferred from fixtures or a leading indicator.

At least ten distinct `pilot-real` items must be pulled after `T0` and reach a
signed release record on the candidate or an Exam-compatible successor during
the window. Deleted, merged-away, synthetic, seeded, demo, test, replayed, or
staff rehearsal items are excluded. The evidence lists included and excluded
item IDs with reasons and proves classification lineage.

| Brief measure | Frozen calculation and pass threshold |
|---|---|
| gate wait time | For every eligible human gate decision, duration is server monotonic/UTC-correlated time from first `decision-ready` event at the decided revision to first valid terminal decision. Report counts and raw durations by gate. Window median must be at most 50% of the like-for-like baseline median. Missing ready/decision pairs fail completeness. |
| zero manual status updates | Schema inspection proves no writable status field; code-host and database audit cover the full window. Numerator is computed state transitions; denominator is all observed state transitions. Pass requires 100% computed and zero manual status writes/escape paths. |
| centralization | Denominator is every eligible Gate 1, Gate 2, Gate 3, and specialist terminal decision for included items. Numerator is those completed entirely through the platform without opening or acting in another tool, from content-free interaction events. Pass requires at least 90%; missing journey events remain in the denominator and not the numerator. |
| human hours per shipped item guardrail | Sum versioned human attention intervals attributable to included shipped items, deduplicated for overlap, divided by included shipped-item count. Use the same collection policy in both windows. Outcome value must be less than or equal to the baseline value; missing intervals or changed collection rules block comparison. |

The outcome evidence retains `pilot-manifest.json`, baseline and outcome raw-event
hashes, inclusion lineage, metric SQL/code revision, clock-quality report,
missingness report, per-measure numerator/denominator/counts, and canonical
`outcome-verdict.json`. Production and fixture stores use separate credentials
and destinations. A validation query must prove no fixture lineage appears in
any production baseline or outcome input.

`outcome-complete` is true only after the full window closes, ten-real-item
eligibility passes, all four measures pass, evidence is current and complete,
and Product Lead plus measurement-owner humans sign the outcome verdict. An
agent may calculate or explain the verdict but cannot sign it.

## Gate 2 candidate pass condition

This document becomes eligible for a human Gate 2 decision only after:

- a new fresh-context Critic reviews the exact commit containing it and reports
  zero unresolved blocker, major, minor, or nit findings;
- all seven activated-domain independent agent review records are current and
  green at that commit, the consolidated exception brief is complete, and every
  deterministic human escalation is resolved;
- actor-bound required CI passes for the actual GitHub author and exact diff;
- the historical supplied Exam copy retains its recorded SHA-256; and
- the Gate 1-signed Brief, Spec, Architecture, and Plan remain byte-identical to
  their accepted commit.

Eligibility is not a signature. This candidate does not approve itself, does not
authorize a Builder, and does not authorize a release, paid service, or push.

## Supplied-source coverage index

| Supplied identifier | Canonical case |
|---|---|
| 1, 2, 3 | OR-01, OR-02, OR-03 |
| 4, 5, 6, 7 | OR-04, OR-05, OR-06, OR-07 |
| 8 | OR-08 |
| 9, 10 | OR-09, OR-10 |
| 9a, 9b, 9c, 9d, 9e, 9f | OR-11, OR-12, OR-13, OR-14, OR-15, OR-16 |
| 11, 12, 13, 14 | OR-17, OR-18, OR-19, OR-20 |
| 15, 16 | OR-21, OR-22 |
| 17, 18, 19 | OR-23, OR-24, OR-25 |

| Architecture revision 2 identifier | Canonical case |
|---|---|
| ADR-17.1 through ADR-17.13 | WS-01 through WS-13, in the same order |
