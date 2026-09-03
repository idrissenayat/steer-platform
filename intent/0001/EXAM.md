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

---

# Gate 2 Exam amendment candidate: Flight Deck Phase 1 production foundation

Item: `0001-flight-deck-foundation`

Author accountability: independent Test Agent

Status: **unsigned remediation annex candidate; not accepted, not implementation or release authority**

## A1. Authority, scope, precedence, and revision binding

This annex is proposed for append-only incorporation into
`intent/0001/EXAM.md` as it exists at
`118302e080598a147294e32d40cf5296763c8cc4`, SHA-256
`e38d6a95145ddafef4b12fb1c795aaa76fdcf009da8cc141ed2430cd69ffcc53`.
When appended and accepted through the normal exact-revision review and human
Gate 2 process, this annex is part of that Exam. Precedence is limited to the
exhaustive table below. `Replace` means the complete text at the named annex
location is the exact replacement. `Augment` means both clauses apply and every
condition in both must pass. All original Exam text not listed remains unchanged.
References below to sections 1 through 16 mean annex sections `A1` through
`A16`. Nothing here changes signed product scope or the `OR-01` through `OR-25`
and `WS-01` through `WS-13` identifiers.

| Exact original clause identifier | Operation | Exact governing text location |
|---|---|---|
| `Revision and source binding`, paragraph beginning “The Exam revision” | augment | `A1`, paragraphs beginning “The Exam revision” and “This annex binds” |
| `Scope-writability and verdicts`, numbered items 1, 2, and 3 | replace | `A2`, numbered items 1, 2, and 3 |
| `Reproducibility contract` including `Frozen inputs`, `Canonical comparison`, `Clocks, environment, repetitions, and percentiles`, and `Required evidence outputs` | augment | all of `A3` |
| `OR-01` | augment | `A4.1`, `OR-01` |
| `OR-02` | replace | `A4.1`, `OR-02` |
| `OR-03` | replace | `A4.1`, `OR-03`; `A8` |
| `OR-04` | augment | `A4.1`, `OR-04`; `A10.2` |
| `OR-05` | replace | `A4.1`, `OR-05`; `A10.1` |
| `OR-06` | replace | `A4.1`, `OR-06`; `A10.1` |
| `OR-07` | augment | `A4.1`, `OR-07`; `A15` |
| `OR-08` | augment | `A4.1`, `OR-08`; `A15` |
| `OR-09` | augment | `A4.1`, `OR-09`; `A8` |
| `OR-10` | augment | `A4.1`, `OR-10`; `A8`; `A11.3` |
| `OR-11` | augment | `A4.1`, `OR-11`; `A11.1` |
| `OR-12` | augment | `A4.1`, `OR-12`; `A15` |
| `OR-13` | augment | `A4.1`, `OR-13` |
| `OR-14` | augment | `A4.1`, `OR-14`; `A8` |
| `OR-15` | augment | `A4.1`, `OR-15`; `A10.1` |
| `OR-16` | augment | `A4.1`, `OR-16` |
| `OR-17` | replace | `A4.2`, `OR-17`; `A7.1` |
| `OR-18` | replace | `A4.2`, `OR-18`; `A8` |
| `OR-19` | replace | `A4.2`, `OR-19`; `A6.2` |
| `OR-20` | replace | `A4.2`, `OR-20`; `A8` |
| `OR-21` | replace | `A4.2`, `OR-21`; `A9` |
| `OR-22` | replace | `A4.2`, `OR-22`; `A9` |
| `OR-23` | replace | `A4.2`, `OR-23` |
| `OR-24` | replace | `A4.2`, `OR-24` |
| `OR-25` | replace | `A4.2`, `OR-25`; `A13` |
| `WS-01` | augment | `A5`, `WS-01` |
| `WS-02` | replace | `A5`, `WS-02`; `A10.1` |
| `WS-03` | augment | `A5`, `WS-03`; `A14` |
| `WS-04` | replace | `A5`, `WS-04`; `A6.1`; `A10.1` |
| `WS-05` | replace | `A5`, `WS-05` and `WF-01` through `WF-08` |
| `WS-06` | augment | `A5`, `WS-06`; `A11.2` through `A11.4` |
| `WS-07` | replace | `A5`, `WS-07`; `A6.3` |
| `WS-08` | replace | `A5`, `WS-08`; `A7.2` |
| `WS-09` | augment | `A5`, `WS-09`; `A8` |
| `WS-10` | augment | `A5`, `WS-10`; `A10.1`; `A11.1` |
| `WS-11` | replace | `A5`, `WS-11`; `A6.4`; `A14` |
| `WS-12` | augment | `A5`, `WS-12`; `A10.1` |
| `WS-13` | replace | `A5`, `WS-13`; `A12` |
| `Signature envelope and negative matrix`, field table | replace | `A10.1`, paragraphs beginning “Every signature” and “Every create” |
| `SIG-01` through `SIG-15`, each identifier individually | augment | `A6.1`; `A10.1`; `A10.2`; `A10.5` |
| `Cross-tenant negative matrix`, every boundary row | replace | `A14`, every boundary row; `A6.4` |
| `Default-closed domain activation and routing`, every domain row and following record rule | replace | all of `A15` |
| `Technical-release verdict`, numbered items 1 through 6 and final failure rule | replace | `A15`, paragraph beginning “technical-release-candidate” |
| `Pilot and 90-day outcome verdict`, all paragraphs and four measure rows | replace | `A15`, paragraphs beginning “Pilot activation” and the four measure rows |
| `Gate 2 candidate pass condition`, all bullets and final boundary | replace | all of `A16` |
| `Supplied-source coverage index`, both tables | augment | `A16`, source-coverage table |

For any non-retention residual ambiguity, the stricter objectively measurable
requirement is the one requiring more evidence, narrower authority, fewer
effects, stronger isolation, shorter latency, lower cost, or broader applicable
coverage. Retention duration is never ordered by this generic rule: longer can
weaken privacy and shorter can weaken records duties. The signed Gate 1 exact
`P90D` content-free PostHog period is immutable by residual inference. Every
unenumerated retention trigger, duration, state, disposition, or selector
conflict blocks acceptance until an Exam author names the exact supersession and
an eligible human signs the governed correction; changing Gate 1 requires a new
Gate 1 decision. Any other ambiguity that cannot be mechanically ordered also
blocks acceptance. No ambiguity may weaken a Gate 1 artifact or silently choose
either text.

This annex preserves and may not weaken the Gate 1 artifact set accepted at
Git commit `281c9736816ec22fa1209b060b58fa8164519f7c`:

| Artifact | SHA-256 |
|---|---|
| `intent/0001/BRIEF.md` | `a5af593397de0722666baefae846b31881c6429c9691bec886f4a0771a8bc97f` |
| `intent/0001/SPEC.md` | `7330397f7a406b1d88d4f6a2c7205e8671d75c07bfec7840775c2b2614af54ff` |
| `intent/0001/ARCHITECTURE.md` (document revision 2) | `9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65` |
| `intent/0001/PLAN.md` | `92696a531e61d988a593b31e81a76cb1aae19348c23d665ed301490ac2544b5f` |
| `intent/0001/signatures/gate-1.json` | `63032a9b2ff0f3a41af0b38b887b648e604336156a5bcefbe32de18648556709` |
| `intent/0001/sources/EXAM.supplied.md` | `5823ddb26d0acbc78b7b58d931d76adfe064adeba84b9cf81fad2557d528eb7b` |

The original 25 supplied requirements remain `OR-01` through `OR-25`, and all
13 Architecture revision 2 walking-skeleton requirements remain `WS-01`
through `WS-13`. The control matrices in sections 5 through 14 make those cases
deterministic; they do not add product capability outside the accepted scope.

The Exam revision is the full 40-character commit containing the eventual
canonical `intent/0001/EXAM.md`. Every review, input, run, signature, exception,
and evidence record is current only when it binds that revision and, where
applicable, the one exact implementation revision. A content or path change
invalidates prior evidence. Builders may not edit the Exam. Agents may author or
test it when independently assigned but may not sign a gate or human seat.

This annex binds these proposed support artifacts by path and current
digest. Their status remains exactly what each file states:

| Proposed support artifact | SHA-256 |
|---|---|
| `intent/0001/reviews/domain/remediation/ACCESSIBILITY-81-CHECKPOINTS.md` | `43d61f4bd52afbb0f206fece2b4f2d784d4af9a4d57fe9f25d2c22a6cab5e361` |
| `intent/0001/reviews/domain/remediation/PERMISSIONS-MANIFEST.candidate.json` | `46a483533cb1153b0391a9463ca6c3848862ed3bf43b9c7e861077860175bf73` |
| `intent/0001/reviews/domain/remediation/SIGNED-LOG-VECTORS.candidate.json` | `1a03cdc28b353036ff612f1d8c93bd3f832e3b1adbc7f77a29a13dbc47a7a168` |
| `intent/0001/reviews/domain/remediation/validate-remediation.mjs` | `15197f339d9eed125885c806f66adff790d67e69247910236b84f9107a0d1044` |
| `intent/0001/reviews/domain/remediation/SIGNED-LOG-SPEC.candidate.md` | `ece4df65505ed563137d6e4797cbe8977a6ef3cfd3be05dd6ef62da9a15ecbbe` |
| `intent/0001/reviews/domain/remediation/RETENTION-AND-RECORDS-POLICY.candidate.md` | `271d4fa1ee2682f06e504e615cc9e8588ea34ff3ff7d5e2c27f245f80509c96c` |

The complete one-way governance binding is
`intent/0001/reviews/domain/remediation/remediation-manifest.json`, SHA-256
`d03fbf07bf9bb3b2616682a278ef9fdce5c0ad278f4aefec3b034cc1cd252369`.
That manifest digest-binds the exception brief, all seven round-one records,
finding resolution, human-ruling questions, preflight input/resolution, and all
support artifacts. It intentionally excludes this amendment; only this
amendment binds the manifest, so no digest cycle exists. Any missing path,
mismatch, or stale digest blocks review and makes every ruling non-current.

The retention candidate must receive HR-01 from a qualified human privacy/legal
records owner over that exact digest before the current commercial Gate 2 can be
eligible. HR-02 is not triggered by the current commercial Gate 2. It is required
only after implementation evidence exists and before a future regulated
technical release or pilot activation, unless an eligible human changes Gate 1
scope and sequencing through the governed process. Neither ruling may be
inferred from this candidate.

## A2. Separate verdicts and hard authorization boundaries

1. `gate-2-exam-eligible` means all seven exact-revision domain reviews are
   green, the consolidated brief has no unresolved finding, all triggered human
   rulings are current, a fresh-context Critic reports zero findings, actor-bound
   Exam-author CI passes, and an eligible human Tech Lead may decide Gate 2.
2. `technical-release-candidate` means every case and matrix row in this Exam
   passes at one implementation revision with complete evidence, release-domain
   reviews are green, and Gate 3 is otherwise eligible.
3. `outcome-complete` means at least ten distinct real pilot items and the full
   90-day outcome contract pass with signed production evidence.

No one of those verdicts authorizes another. Gate 1, Gate 2, Gate 3, a test
result, a release candidate, the regulated profile, or the $1,000 monthly pilot
infrastructure ceiling authorizes production, provisioning, a paid request,
deployment, release, or spending. Each requires its separately named, current,
eligible-human record described in section 11.

## A3. Reproducibility and evidence contract

Before a technical run, commit
`packages/testkit/fixtures/intent-0001/manifest.v2.json`. It enumerates every
input by path, bytes, SHA-256, schema, classification, expected output, and
applicable cases. Missing, extra, duplicated, stale, or mismatched inputs fail.
Pseudorandom tests use UTF-8 seed `steer-0001-exam-v2`, `xoshiro256**`, 10,000
examples, and retained sub-seeds/shrinks. Functional time uses a seeded virtual
UTC clock. Security-time cases also use real UTC and fail above 50 ms offset.

JSON is RFC 8785 canonical UTF-8. Markdown/text is UTF-8 without BOM, Unicode
NFC, LF, no trailing whitespace, and significant final newline. Unordered rows
sort by `(organization_id, repository, item_id, record_type, logical_id)`.
Semantic UI equality compares route, headings, labels, roles, values, states,
and ordered content with volatile fields replaced only by schema-declared
tokens. Equality is SHA-256 equality over canonical bytes.

The reference environment is clean Linux `x86_64`, 4 dedicated vCPU, 16 GiB
RAM, local SSD, production builds, telemetry enabled, and stack-lock digests.
Record CPU, kernel, load, memory, region, network, database size, and all images.
Performance cases use 30 unrecorded warmups and 200 retained observations in
each of three clean runs. `p95` is nearest rank `ceil(0.95*N)`; every run passes
independently. No missing, timeout, cancellation, or discarded outlier passes.

Every run retains canonical `run-manifest.json`, `case-results.json`,
`side-effects.jsonl`, `environment.json`, `input-manifest.json`, `metrics.json`,
`trace-index.json`, `artifact-hashes.json`, `authorization-decisions.jsonl`,
`credential-effects.jsonl`, `cost-ledger.jsonl`, and `record-inventory.json` at
`evidence/0001/<exam-revision>/<implementation-revision>/<run-id>/` or through
an immutable tenant-scoped object whose Git reference carries the same path,
hash, media type, size, producer, and revisions.

The side-effect and credential ledgers record attempted and completed Git/code-
host writes, database/object/cache mutations, workflow actions, model and secret-
manager reads, GitHub installation-token exchanges, credential selection,
tool discovery/invocation/dispatch, sandbox/network actions, notifications,
provisioning, and paid requests. Authentication may perform only the minimum
`verification-material-access`: read an allowlisted OIDC public verification key
or select/read the exact webhook HMAC verification key after non-secret public
routing. That access is recorded by key ID, selector, purpose, and result and is
not a downstream operational credential effect. Before authentication and
authorization pass, protected-body parsing and every `operational-credential-
effect` are prohibited: installation-token exchange, model/evidence/release
credential selection, tool discovery/invocation/dispatch, provider mutation,
workflow, notification, provisioning, paid request, or write. Every negative
case requires stable denial, no access beyond the minimum verification material,
and zero prohibited operational effect.

## A4. Original supplied requirements, preserved

### A4.1 Authority, projection, decisions, and attention

**OR-01 — Complete board-state matrix.** Exhaust every valid combination of
artifact presence, signature state, checks, profile, domains, and revision; the
Flight Board equals the expected state. Enumerated invalid combinations fail
closed with no authoritative write.

**OR-02 — Git-only destroy and rebuild.** Capture every tenant's canonical
projection and semantic view, destroy all Postgres schemas including ingestion
events/cursors plus every index, cache, workflow projection, and analytics
projection, and rebuild authoritative business state solely from enumerated
Git/code-host records. Run once with any external event archive disconnected.
An archive may be used only as integrity-checked transport input in a second
diagnostic run. Retain pre/post bytes and hashes per tenant and projection type;
any private non-Git repair input fails.

**OR-03 — Complete privacy/storage reconstruction inventory.** Apply the
section 8 inventory to every selected commercial and regulated binding. Every
surface has `applicable` or a testable exclusion rationale, classification,
retention owner, reconstruction potential, and crawl/rebuild probe. No authority
may exist outside Git/code-host records; every mirror is destroyable and binds a
current authoritative reference.

**OR-04 — Decision-card authorization.** Across all frozen subjects, hats,
profiles, domains, gate states, revisions, prior decisions, and transfer states,
a card appears if and only if ready and routed to a currently eligible human.

**OR-05 — Exact-revision signature.** A valid action writes the section 10
signature record against displayed bytes. Mutation between render and action
denies, writes only one non-approval attempt record, and presents the new
revision.

**OR-06 — Send-back.** Send-back uses the section 10 mutation envelope, writes
one attributed note to the correct chain path, leaves the gate unsigned, creates
no approval mirror or advance, and is idempotent across every partial-failure
state.

**OR-07 — Domain routing and SLA.** Each activated domain routes one current,
fresh-context, Builder-independent review; inapplicable domains route none.
Every policy trigger creates the eligible human card. Crossing the 24-hour
deadline under virtual time renders escalation within 60 real seconds without
approval or release effect.

**OR-08 — Gate 3 evidence view.** At the displayed implementation revision show
every Exam result, capped/ranked Critic findings, plan conformance, domain
reviews, consolidated brief, human dispositions, evidence hashes, and verdict.
Unavailable, missing, stale, wrong-tenant, or mismatched evidence is explicitly
non-current and blocks eligibility.

**OR-09 — Originator flow.** A scripted non-engineer session produces a valid,
originator-attributed `BRIEF.md` through conversation/correction/save with no Git
or Markdown terminology in any visible state.

**OR-10 — Originator assistant regression.** Run exactly 20 manifest-hashed,
sanitized real prompts three times at temperature 0 with prompt, template,
model/config, tool registry, locale, and token ceiling pinned. Every draft has
problem, outcome, affected users/systems, constraints, and open questions; all
system names resolve; hallucinations are zero; no field or total pass rate falls
below the signed baseline. Any bound change reruns all 60.

**OR-11 — WIP refusal.** At and above every person-level limit across pods and
hats, pull is denied visibly with no item, workflow, notification, paid request,
or authoritative write.

**OR-12 — Measurement state.** `measurable` requires resolvable production
metric and denominator; `greenfield` requires the declared leading-indicator
rule; otherwise `unresolved`. Fixture or synthetic telemetry never qualifies.

**OR-13 — Duplicate clustering.** The frozen corpus/seed yields exact declared
clusters and no unrelated joins across 10,000 perturbations; retain memberships,
scores, threshold, model/config revision, and minimal shrink.

**OR-14 — Decay without deletion.** At every virtual-time boundary untouched
intents expire with original and expiry timestamps, are not deleted, and reappear
only from a newly attributed signal.

**OR-15 — Decline and cooldown.** Decline records its actor-bound reason,
supplies Scout tuning input, and suppresses re-notification for the exact frozen
cooldown with deterministic boundary and retry results.

**OR-16 — Protected attention.** Semantic order is decision inbox, triggered
candidates, ambient flight. Ambient flight emits no notification except a
declared band breach.

### A4.2 Security, privacy, accessibility, performance, and portability

**OR-17 — Least privilege.** Compare every effective provider permission with
the section 7 manifest. Extra permission, missing denial, undeclared delegation,
or credential lifetime above the manifest fails.

**OR-18 — Content-free observability and residue.** Apply section 8 canaries to
every inventory surface for both wrong-tenant and same-tenant unintended
persistence. Any exact, prefix, truncation, reversible encoding, formatted
exception, attribute/dimension, history, index/vector, request/response cache,
object version, sandbox, filesystem, or container residue fails.

**OR-19 — Webhook authenticity and replay.** Execute every section 6.2 vector.
Exactly one valid delivery produces one projection. Every other attempt has a
stable denial and zero prohibited effects.

**OR-20 — Originator retention.** Enforce the bound retention candidate only
after an eligible qualified-human signature over its exact digest. Before save,
text stays solely in the declared session boundary. Save leaves only the
authoritative artifact and governed recovery copies; abandonment erases all
copies within 60 seconds. Test events, failure, holds, and PostHog separation at
every boundary. Without the signed policy, Gate 2 and originator release fail.

**OR-21 — Complete automated accessibility.** Run automated rules against every
section 9 route/state/viewport. The conformance ledger has one row for every
applicable WCAG 2.1 Level A/AA success criterion and every applicable Revised
Section 508 software/web requirement, identifying automated, manual, or combined
evaluation. Any unresolved failure, including moderate/minor/unclassified tool
output, fails; axe impact labels are diagnostic only. Registry completeness and
zero omitted route/story/state are pass predicates.

**OR-22 — Complete human accessibility.** A qualified human specialist executes
every section 9 scenario/environment pair and all 81 checkpoints in the bound
model. Retain raw checkpoint-level results and a separately signed summary bound
to exact Exam/implementation revisions. `not-applicable` needs a criterion-
specific rationale. Any unresolved conformance failure blocks user-facing
technical release regardless of severity.

**OR-23 — Decision-inbox latency.** Load 50 decisions across 10 repositories.
Start is client monotonic event `decision-inbox-request-start` emitted immediately
before the production API call; terminal is client monotonic event
`decision-inbox-semantic-ready` emitted only when heading, ordered 50-card list,
all accessible names/states, and no busy/loading indicator satisfy the frozen
predicate. Both are emitted by `apps/web` under one trace/correlation ID and one
Performance clock. Every raw pair is included. Each run p95 is at most 2,000 ms.

**OR-24 — Projection and reconciliation latency.** Ingest 2,000 ordered events
and drop the 100 manifest positions. Start is trusted-ingress UTC event
`codehost-event-available`; terminal is projector UTC event
`semantic-projection-committed` containing the expected semantic-state digest.
Both bind one event/correlation ID; OTel synchronized offset must be at most
50 ms. Non-dropped p95 is at most 60 seconds. For dropped events, start is the
same manifest-scheduled ingress availability and terminal is the reconciliation
commit; all restore within 600 seconds. Every sample and offset is retained.

**OR-25 — Hermetic self-hosted core.** From a cold clean checkout with section
13 bindings, empty application caches, exact preloads, no undeclared environment
credential/secret mount, and default-deny network, execute OR-01 through OR-24.
Capture every DNS, socket, HTTP, credential-provider, and control-plane attempt.
An omitted case, undeclared endpoint, SaaS/control-plane request, baked secret,
or pre-populated cache fails.

## A5. Walking skeleton, failure interleavings, and parity

**WS-01 — Interview and render.** Complete OR-09/10 on the production
conversation and rendered UI path.

**WS-02 — Originator GitHub commit.** Save through the GitHub App under verified
originator identity and the section 10 mutation contract; prove exact tenant,
repository, bytes, idempotency, least privilege, conflicts/timeouts/retries, and
no database-first success.

**WS-03 — Correct projections.** Project that event into exactly one backlog,
Flight Board, and eligible inbox; pass OR-01/04 and all tenant negatives.

**WS-04 — Complete human signature.** Record the complete section 10 envelope
through production authorization and Git; execute sections 6.1 and 10. Agents,
invalid identity, stale state, and unsafe retries always fail closed.

**WS-05 — Durable Gate wait.** Execute each injection row below with one and
then three consecutive worker replacements, deterministic replay, the pinned
Mastra adapter, and direct-Temporal fallback. Retain workflow/run IDs, full
history, build IDs, timer deadline/fire, idempotency key, attempts, authoritative
writes, and side effects. Exactly one workflow and authoritative result may exist.

| Injection ID | Terminate worker |
|---|---|
| `WF-01` | before activity dispatch |
| `WF-02` | after dispatch, before external Git request |
| `WF-03` | after Git commit, before provider response |
| `WF-04` | after provider response, before activity acknowledgement |
| `WF-05` | one tick before timer deadline |
| `WF-06` | after timer fires, before acknowledgement |
| `WF-07` | during deterministic history replay |
| `WF-08` | during adapter upgrade/fallback switchover |

**WS-06 — Configuration-only model swap.** Call pinned configuration A, change
only the model configuration to compatible B, and call again. Domain, tool,
workflow, and API hashes remain unchanged; eval, tenant routing, and section 11
budget/model ledgers pass for both.

**WS-07 — MCP/UI authorization parity.** Execute the section 6.3 matrix over MCP
v2 Streamable HTTP and UI/API. Stdio is excluded remotely. Canonical decision,
error, tenant, idempotency, and audit bytes match.

**WS-08 — Hostile readiness sandbox.** Run the Stack Pack scan inside each
section 7 sandbox fixture. One frozen valid finding creates one attributed draft
on-ramp Brief; retry creates no duplicate or Builder dispatch. All hostile rows
fail without host/network/secret escape and with complete cleanup.

**WS-09 — Immutable evidence.** Put evidence in the tenant bucket, commit its
full hash reference, retrieve/verify bytes, and refuse mutation. Cross-tenant and
same-tenant lifecycle behavior follows sections 8 and 10.

**WS-10 — One-confirmation topology.** The platform-agent conversation proposes
organization, portfolio, product, pod, hats, registered agent, specialist pool,
Stack Pack, repositories, product brief, mission brief, and first intents.
Before confirmation there are zero structural/paid effects; one verified human
confirmation writes exactly the declared topology through registered tools. The
agent never signs.

**WS-11 — Cross-tenant refusal.** Execute section 14 for every principal and
operation. Authorization precedes credential/tool access; all responses and
timing meet the oracle rule; zero prohibited effect occurs.

**WS-12 — Gate 3 second look.** Same-session Gate 3 and pre-build-Critic Gate 3
fail with one non-approval attempt and no signature. Only new authenticated
session(s), after a passing exact-revision build Critic, can become eligible.

**WS-13 — Git-only identical reconstruction.** Destroy every state named in
OR-02, disconnect ingestion archives, reconstruct solely from enumerated
Git/code-host records, and prove canonical/semantic equality for every tenant.

## A6. Identity, webhook, MCP, and timing matrices

### A6.1 OIDC and session matrix

The test binding accepts issuer
`https://idp.test.steer.invalid/realms/steer`, audience `steer-web`, `alg=RS256`,
`typ=JWT`, an allowlisted `kid`, unique scalar `iss/sub/aud/exp/iat/jti`, optional
scalar `nbf`, and maximum 60-second clock skew. The session binds token hash,
issuer, subject, organization, active hats, authentication instant, nonce,
browser session ID, and CSRF/request origin. Session maximum age is 8 hours and
idle age 30 minutes. Production values are selected in a revision-bound identity
manifest; no wildcard issuer/audience/algorithm/key is allowed.

Positive rows cover exact valid claims, `exp` and `nbf` at each ±60-second skew
boundary, current key, next key after atomic rotation, and one refreshed session.
Negative rows cover missing/malformed/duplicated claims, wrong issuer/audience/
algorithm/type/key, `alg=none`, unknown/retired/revoked `kid`, bad signature,
expired/not-yet-valid/issued-in-future, reused `jti` or nonce, access/ID-token
substitution, subject/token/session/browser/organization substitution, revoked or
disabled/transferred subject, changed/revoked hat, expired/idle/revoked session,
CSRF/origin mismatch, and rotation races. Every negative row returns stable
`AUTHN_INVALID` or `AUTHZ_DENIED`, records no protected claim value, permits only
the A3 public-key verification-material access, and has zero downstream
operational credential, tool, write, signature, workflow, notification, or paid effect.

### A6.2 GitHub webhook contract

Verify the unmodified raw request bytes using the one and only
`X-Hub-Signature-256: sha256=<64 lowercase hex>` header and HMAC-SHA-256 with the
tenant/repository installation secret selected only after non-secret public
installation routing. Record this narrowly scoped verification-key access under
A3. Do not parse the protected JSON body or select any operational credential
until the HMAC passes. Require one valid UUID `X-GitHub-Delivery`, one
allowlisted event header, maximum 10 MiB body, trusted ingress timestamp, and
constant-time digest comparison. First processing starts within 300 seconds of
trusted ingress. The replay key is `(installation, delivery-id, sha256(raw))`;
the `(installation, delivery-id)` to body-hash binding and accepted/rejected
result persists across restart for 90 days. At exactly 300 seconds processing is
allowed; one nanosecond later it is denied. At exactly 90 days the tombstone is
still effective; only after it expires may reconciliation, never webhook replay,
recover the event.

Vectors cover missing/malformed/duplicated signature/delivery/event headers,
uppercase/wrong-length digest, altered raw byte/encoding/line ending, parsed-body
reserialization, wrong algorithm/key/installation, current secret, new secret
after atomic rotation, old secret before and at retirement (allowed through the
declared overlap) and after retirement (denied), unknown key, 300-second and
90-day boundaries, restart, 100 simultaneous identical deliveries, and 100
same-ID/different-body deliveries. Exactly one valid request projects once; all
others permit only recorded verification-key access and raw-byte hashing and
have zero protected-body parse, operational-credential, installation-token,
projection, write, workflow, tool, notification, or paid effect.

### A6.3 MCP Streamable HTTP matrix

For query, write, tool discovery, and invocation, test verified humans and
service identities plus absent, malformed, expired, revoked, substituted,
wrong-organization, wrong-session, and wrong-request tokens. Test reconnect,
resume token, duplicate request/idempotency replay, cross-session resume,
unknown/disallowed tool, schema smuggling, wrong `Origin`, missing TLS binding,
method/content-type mismatch, and request-body hash mismatch. Allowed origins are
exact revision-bound HTTPS origins; `null`, wildcard, suffix, and mixed-scheme
origins fail. Discovery returns only granted tools. Each result must be canonical-
equal to UI/API authorization; except for the minimum A3 authentication-
verification material, denial precedes every operational credential/tool/
dispatch and creates no write or workflow.

### A6.4 Timing-oracle protocol

For every externally observable section 14 boundary, use matched existing and
non-existing targets with the same tenant topology, response status/body/length,
connection reuse, cache state, payload size, server load, region, and code path.
Run 50 warmups then 500 interleaved pairs per principal/operation in each of
three clean runs using manifest-seeded order and one monotonic observer clock.
Retain all raw samples. A row fails if absolute Cliff's delta exceeds `0.147`,
absolute paired median exceeds `5 ms`, or a two-sided paired permutation test is
significant at family-wise `alpha=0.01` after Holm correction. Missing/timeout/
retry samples fail and may not be discarded. Response normalization itself is
asserted byte-for-byte.

## A7. Permission manifest and sandbox boundary

### A7.1 Effective permission baseline

The authoritative test oracle is schema `steer-permissions-manifest/v2` at
`intent/0001/reviews/domain/remediation/PERMISSIONS-MANIFEST.candidate.json`,
SHA-256 `46a483533cb1153b0391a9463ca6c3848862ed3bf43b9c7e861077860175bf73`.
It enumerates provider-native actions/scopes, exact resource selectors, issuer,
audience, maximum lifetime, delegation path, and required denials for every
principal below. Missing/extra entries or any digest mismatch fail OR-17. For a
selected action, the request must contain every `requiredSelectorCategories`
category exactly once. Every exact value is mandatory; each prefix category is
mandatory and must match one declared literal-prefix alternative. Missing,
duplicate, unrecognized, malformed, wildcard, wrong, zero-match, or multi-match
selectors deny before credential, tool, dispatch, or write. `organization` is
required in every action row; `active-hat:required` succeeds only from
independently verified current item eligibility, never a caller assertion.
Every provider permission must map to at least one existing exact application
action, and every provider-backed application action must be mapped from at
least one declared provider permission. `applicationActionsExact` is exhaustive
in both directions. An excluded action must be explicitly `internal-only`, use
the `internal:` namespace, state a nonempty exact reason, and have no provider
mapping; otherwise it fails. The approval-record action maps specifically to
GitHub `contents:write` for its exact bound repository, ref, and signatures path.
An orphan, unmapped, unknown, contradictory, or reclassified mapping fails.

Every credential is short-lived, tenant/repository/resource bound, non-
delegable except along the named path, and default-deny outside these actions:

| Principal/credential | Allowed actions and scope | Lifetime/delegation | Required denials |
|---|---|---|---|
| verified human session | registered queries; eligible gate/item commands in own organization | 8h max, 30m idle; OIDC to BFF only | agent/admin/provider scopes; other tenant; inactive hat |
| GitHub App installation | metadata/read contents/checks; create item commits; exact approval/review/status writes in bound repos | installation token <=1h; App to installation only | admin, billing, secrets, org write, repo delete, broad installation |
| platform agent | registered non-signing tools for assigned organization/task | service token <=15m; registry only | sign, raw DB/code-host, ungranted tool, cross-tenant |
| revoked/disabled agent | none | none | discovery, query, credential, tool, write |
| API/worker/reconciler | exact queue/workflow and tenant projection operations; adapter calls required by job | workload token <=15m; no onward delegation | human signature, arbitrary repo, interactive admin |
| CI | read source; write checks/evidence for exact repository/run | OIDC token <=15m | production, secrets list, repository content write, signature |
| sandbox workload | read-only checkout and declared readiness outputs | one execution <=60s; brokered one-use secret | host/socket, arbitrary network, other repo/tenant, signing |
| model credential | LiteLLM call for exact tenant/pod/execution/config | one-use or <=5m; gateway only | direct provider use, fallback outside manifest, other budget/key |
| evidence credential | put/get exact tenant object/version operation | one-use or <=5m | list-all, delete/mutate referenced object, other tenant |
| administrator | policy-authorized admin commands in own organization | human session; no impersonation | signing as another subject, bypass RLS/gates, raw provider key |
| release-rails credential | observe; execute only with section 11 authorization | one-use <=5m | provisioning/spend/release without named record |

The run captures provider-native effective permissions, resource constraints,
delegation chain, issue/expiry/revocation, and compares them exactly. Any extra
effective action/resource/lifetime fails, even if unused.

### A7.2 Malicious readiness fixtures

Each fixture runs same-tenant and cross-tenant variants: `../` and absolute path
escape; symlink/hardlink/device/mount escape; `/proc`, host filesystem, Docker/
containerd/Kubernetes/control sockets; undeclared DNS/HTTP/loopback/link-local/
metadata egress; fork bomb, 65th process, CPU/wall/memory/file/storage limits;
subprocess/namespace/capability escape; secret listing, environment/file/log/
DNS exfiltration; expired/rotated/revoked one-use credential; and cleanup after
success, failure, 60-second timeout, and worker kill.

Sandbox baseline: unprivileged user, read-only root, no host mounts/sockets,
`no-new-privileges`, empty capabilities, seccomp/AppArmor equivalent, 1 vCPU,
512 MiB RAM, 64 processes, 64 MiB writable ephemeral volume, 30 CPU seconds,
60 wall seconds, and default-deny egress except manifest-local code-host fixture,
artifact sink, and DNS stub. Pass requires zero host/undeclared network access,
zero secret enumeration/exfiltration, no reusable credential, and no process,
mount, network, or volume residue after teardown.

## A8. Privacy inventory, canaries, and record lifecycle

The manifest must contain one row for every: browser memory/DOM/form buffer,
cookie/session/local/IndexedDB/cache/service worker/download/clipboard surface;
API/BFF/process memory/temp file; Git/code-host object, reflog, fork, review,
check, artifact, and provider backup; Postgres table/WAL/archive/snapshot/replica/
backup/recovery log; full-text/vector/index/cache; Temporal history/task/dead-
letter/visibility/backup; object current version/prior version/replica/inventory/
backup; model gateway/provider request, response, cache, abuse log, and training-
retention setting; OIDC provider/session/audit log; CDN/WAF/load-balancer/DNS/
proxy/queue; logs/traces/metrics/analytics/error reports; CI artifacts/caches;
sandbox/container/node filesystem/volume/image layer/crash/core dump; notification
provider; operator workstation export; and disaster-recovery copy.

For each surface record profile/provider, exact location, data classes, tenant
key, encryption, access path, retention/deletion mechanism, backup propagation,
reconstruction risk, applicability or exclusion proof, and exact crawl query.
Seed distinct canaries for secret, token, originator text, artifact content,
forbidden tenant identifier, and model input. Probe exact value, every prefix of
length 4+, every truncation length 4+, base64/base64url/hex/URL/JSON/HTML encodings,
case/whitespace normalization, stack/exception formatting, attributes,
dimensions, history, search snippets/facets/counts, vectors/model context,
request/response caches, versions, residue, and restored backups. Any prohibited
same-tenant persistence or cross-tenant disclosure fails.

The proposed retention policy bound in section 1 governs lifecycle tests. Every
class runs one second before, at, and after expiry; no hold, active/released/
overlapping hold; wrong tenant/object; stale policy; partial/timeout deletion;
backup reappearance; restore; missing receipt; hash mismatch; export; tombstone;
and broken-reference recovery. Referenced evidence additionally runs exact
revocation/tombstone-prerequisite true, false, missing, incomplete, ambiguous,
and hash-mismatch rows. Every unmet-prerequisite row must retain immutable bytes,
return only `retained-pending-safe-disposition`, emit no deletion request, retain
the prerequisite-evaluation evidence required by the policy, and block release.
Only an exact later `reference-revocation-authorized` event may transition it to
`quarantined-deletion-pending`; verified completion plus tombstone transitions it
to `deleted-tombstoned`. Unknown deletion outcomes quarantine and block success.

## A9. Accessibility inventory and conformance matrix

### A9.1 Complete route and state inventory

Required production routes are: `R01 /` decision inbox; `R02 /intents`; `R03
/flight`; `R04 /items/:itemId`; `R05 /learn`; `R06 /originator/new`; `R07
/onboarding`; and `R08 /auth/return`. Each route tests applicable normal,
loading, empty, error, permission-denied, stale, breached, offline/reconnect,
and session-expired states. `R01` and `R04` additionally test Gate 1/Gate 2/
Gate 3 cards at ready, blocked, conflicted, unsigned, signing, signed, declined,
send-back, and provider-unknown states. They also test security/privacy/money/
legal/reliability/irreversible specialist cards at not-triggered, waiting,
SLA-breached, signed-disposition, and stale-disposition states. `R06`/`R07` test
streaming, interrupted stream, correction, validation error, discard, save,
confirmation dialog, cancelled confirmation, and authoritative-save failure.

Storybook enumerates every shared decision card, specialist/escalation card,
conversation message/stream, correction editor, signature dialog, status badge,
evidence panel, board lane/card, intent card, notification, error summary, and
empty/loading shell in every applicable state above. The test compares this
inventory with the built route registry and Storybook index in both directions;
any built route/story/state not listed, or listed entry not built, fails.

Viewports are `1440x900` desktop, `1024x768` compact desktop, `390x844` mobile,
and `320x800` reflow. Run 200% browser zoom, WCAG text-spacing overrides,
reduced-motion, forced-colors, light/dark themes when shipped, and portrait/
landscape where supported.

### A9.2 Requirements and manual environments

The run freezes an official WCAG 2.1 A/AA and Revised Section 508 requirement
catalog by source URL, retrieval date, license, local path, and SHA-256. A
completeness test compares all catalog IDs to `accessibility-conformance.json`.
Each applicable requirement identifies automated evidence, one or more bound
`A01`-`A81` checkpoints, or both; `not-applicable` requires human rationale.

Manual environments are: Windows 11 + current supported Chrome + current JAWS;
Windows 11 + current supported Firefox + current NVDA; macOS + current supported
Safari + VoiceOver; iOS + Safari + VoiceOver; and Android + Chrome + TalkBack.
Exact versions are frozen in the run manifest. Each combination executes login,
inbox discovery, Gate card review, specialist escalation review, item evidence,
stale/conflict recovery, send-back/correction, streaming originator/onboarding,
dialog cancel/confirm, and signature confirmation. Keyboard-only desktop passes
run separately. Raw 81-checkpoint rows are mandatory for each applicable pair.

## A10. Legal record, mutation, transfer, migration, and release safety

### A10.1 Signature and decision-attempt records

Every signature binds: organization; item; code-host/provider and repository
stable IDs; artifact path; RFC-8785 or normalized-text SHA-256 digest; full Git
revision; gate/specialist seat and positive sequence; decision; server UTC
timestamp; verified OIDC subject; active hat; identity issuer; immutable identity-
verification evidence reference; session ID; authorization-policy path/revision/
digest; provider proof type; and durable provider record ID. Canonical JSON uses
section 3 rules. Retrieval/verification repeats after session expiry, subject/
hat transfer, provider-display-name change, and projection destruction.

Every create, sign, decline, merge, send-back, release, and other authoritative
attempt uses one envelope containing those applicable fields plus attempted
operation, stable reason, idempotency/correlation IDs, provider request hash,
provider response/reference, authoritative/audit location, projection cursor,
and status `refused`, `unknown`, `committed`, or `projected`. Allowed transitions
are `attempted -> refused`; `attempted -> unknown -> committed -> projected`;
or `attempted -> committed -> projected`. Only reconciliation from durable
provider proof resolves `unknown`. Retries reuse the same logical record.

Test missing/duplicated/malformed field; tenant/repository mismatch; unverified/
disabled/transferred subject; inactive/browser-asserted hat; wrong seat/sequence;
short/stale/nonexistent/cross-repo revision; expired/revoked/empty/same-session
violation; unknown/disallowed/client-timestamp decision; agent/copy-human claims;
concurrent action; conflict; timeout before/after effect; provider partial result;
process crash before/after each state; projection failure; retry/replay; and
reconciliation. Require one authoritative result or explicit safe-to-retry
non-result, one attempt record, zero duplicate mirror/signature/advance.

### A10.2 Accountability transfer

For each pending, ready, rendered, attempted, committed, projected, declined,
send-back, and signed state, transfer and reassign the hat before and after the
state; revoke/disable predecessor and successor variants; present simultaneous
stale cards; and retry. Open decisions route only to the eligible successor.
Completed records forever retain original subject, then-active hat, sequence,
revision, timestamp, identity evidence, and provider proof without reassignment.

### A10.3 Forward-only migration and rollback

The manifest enumerates every supported `(schema, old-app, new-app)` version.
For each, test expand; concurrent old/new readers/writers; tenant-scoped resumable
backfill; interruption before/after every batch/checkpoint; retry; application
rollback before/during/after backfill; migrate; contract request; and contract
refusal. Production accepts forward-only expand/migrate; destructive contract
is denied until a separately signed later cleanup item names exact columns/data,
backup, affected tenants, expiry, rollback consequence, and authorization.

Retain pre/post canonical hashes for item, signature, attempt, audit, release,
and evidence truth; migration journal; compatibility results; side effects;
backup/PITR evidence; and restoration. Any loss, reinterpretation, cross-tenant
effect, duplicate, non-idempotent retry, unsupported mixed version, or unsigned
destructive cleanup fails.

### A10.4 Release plan and record

The plan/record binds verified eligible human and active hat, organization,
repository/item, exact Exam/implementation revisions, current evidence manifest
and hashes, release configuration/flag/canary/threshold/rollback, authorization-
policy revision, server timestamp, idempotency, separate production and spend
authorization IDs, and durable release-rails result. Test stale evidence,
revoked authority, same-session second look, conflict, timeout before/after
effect, retry, 1% canary, threshold abort, partial rollout, recovery, and
reconciliation. One external rollout result or safe non-result is required.

Gate 2, Gate 3, technical status, or pilot ceiling must fail as a production or
spend authorization. A named current human production authorization is distinct
from the section 11 spend authorization; both are required for a paid production
effect. Expired/revoked/stale/wrong-tenant records deny before release credential.

### A10.5 Regulated-use prerequisite

For a future regulated activation, technical release and pilot activation fail
closed unless the exact signed-log specification digest in section 1 is
implemented and every positive/negative/export test in it passes at the exact
implementation revision, and a separate current qualified-human HR-02 record
names applicable obligations, reviewed evidence, permitted use, limitations,
retention policy, Exam/implementation revisions, specification digest, signer
identity/qualification, decision, expiry/review date, and signature. Commercial
approval cannot substitute. HR-02 is not triggered by the current commercial
Gate 2 and is evaluated only when implementation evidence exists. A stale,
missing, declined, conditional-unmet, or unverifiable HR-02 yields zero regulated
release or pilot effect. Earlier timing requires a governed human Gate 1 change.

## A11. Cost control and spending authorization

### A11.1 Named authorization record and pre-spend denial

The only spend grant is `SPEND-AUTHORIZATION.json`, signed by an eligible human,
binding organization/product/pod/tenant, environment, purpose, allowed providers/
SKUs, infrastructure/model cost classes separately, currency, period, maximums,
effective/expiry timestamps, policy/price revisions, approval identity/hat,
server timestamp, and revocation/restart terms. It never derives from a gate or
ceiling. Before a valid current record, setup, integration tests, model calls,
sandbox, storage, analytics, observability, orchestration, provisioning,
deployment, release, fallback, and retry each return `SPEND_NOT_AUTHORIZED`
before provider credential/request, with zero provisioned resource and charge.
Provider-side zero-usage/billing evidence and local ledger agreement are required.

### A11.2 Frozen cost-control case

Synthetic price revision `cost-test-v1`, USD banker-rounded to cents: compute
`$0.10/vCPU-hour`; memory `$0.01/GiB-hour`; storage `$0.02/GiB-month`; egress
`$0.05/GiB`; analytics `$0.001/1000 events`; model input `$0.002/1000 tokens`,
cached input `$0.001/1000`, output `$0.006/1000`, tool call `$0.001`. These are
test oracles, not provider forecasts or spending authority.

Infrastructure limits are organization/tenant `$1000/month`, product `$800`,
pod `$500`, execution `$5`, sandbox 1 vCPU/512 MiB/60 s/64 MiB, egress 10 MiB,
evidence 1 GiB/run and 10 GiB/item. Model cost is excluded and separately limited
to organization `$200/month`, product `$150`, pod `$100`, execution `$2`.
One key/cache/quota/fallback map is frozen per scope; no fallback may cross it.

Atomically reserve the maximum estimated cost before credentials/use, charge
actuals against the reservation, and release only unused balance. Run exact-
limit, one-cent-below/above, ten simultaneous one-cent-below requests, inherited
sub-limit exhaustion, cache hit/miss, fallback, and tenant A/B probes. A request
must fit every scope; any missing/stale price, budget, attribution, reservation,
or provider usage denies. No tenant consumes another key/cache/quota/budget.

### A11.3 Spend-amplification bounds and model ledger

One logical operation has one billable idempotency key. Model work permits one
primary plus one fallback attempt, maximum 16,000 input/cached and 4,000 output
tokens total, 10 tool calls, and 60 seconds. Workflow activities permit three
attempts but must reuse a prior billable provider result. Reconciliation/replay/
worker replacement may perform zero new billable work. Sandbox and storage limits
are those above; analytics emits at most 100 events/execution. Exceeding a limit
cancels before additional charge and records `COST_BOUND_EXCEEDED`.

Each model row records organization, tenant, product, pod, execution,
idempotency, model/config revision, provider, price revision/currency, input,
output, cached units, tool/fallback calls, attempted/billed units/cost, budget,
reservation, actual, invoice usage ID, and reconciliation status. Model rows are
never counted inside the $1,000 infrastructure ceiling.

### A11.4 Forecast, actual, breach, shutdown, and reconciliation

The billing period is calendar month UTC; currency is USD and banker rounding
occurs once at ledger-line and aggregate close. Forecast records assumptions and
low/expected/high totals by cost class. Actual/accrued records bind usage and
provider IDs. Reconciliation completes within 24 hours of provider data; pass is
exact unit agreement and the greater of `$0.01` or `0.5%` cost variance. Missing
data, unknown price, or late reconciliation blocks release.

At 80% of any authorized sub-limit alert within 60 seconds. At 100%, reserve no
new work, revoke workload credentials within 30 seconds, finish only already
committed non-incremental work, and prove zero post-shutdown paid request/charge.
Restart requires a new or amended signed authorization and reconciliation through
shutdown. Retain forecast, budget, authorization, reservation, usage, invoice,
variance, alert, shutdown, revocation, restart, and audit lineage.

## A12. Recovery and disaster-recovery rehearsals

Execute the versioned runbook at frozen failures and retain raw UTC/monotonic
timelines, manifests, commands, digests, attempts, and operator identity:

| Case | Required result | RPO | RTO |
|---|---|---:|---:|
| Git/code-host loss | restore replicated authoritative refs/objects and verify every hash | 0 accepted commits | 60 min |
| Postgres loss | PITR, then destroy/rebuild from Git; database never repairs authority | 5 min projection events | 30 min |
| evidence-store loss | restore every referenced version and verify Git-bound bytes/hash | 0 referenced objects | 60 min |
| Temporal loss | repair/recreate workflow/timers from Git projection without duplicate effect | 0 authoritative state | 30 min |
| complete regional loss | restore authority access, evidence, disposable services, and semantic view | 0 authority/evidence | 4 h |

Missing, stale, partial, wrong-tenant, wrong-version, or hash-mismatched evidence
fails. A restored projection or workflow that disagrees with Git is destroyed and
rebuilt, never promoted.

## A13. Hermetic bindings and portability

Cold-run preloads are only repository checkout, stack lock, fixture manifest,
container images by digest, synthetic certificates/keys, and local test data.
Environment is allowlist-empty except declared non-secret test variables.
Allowed endpoints are loopback/container-network DNS names for Postgres,
Temporal, LiteLLM, model stub or local vLLM, Keycloak, GitHub/GitLab adapter
fixture, MinIO, PostHog, OTel collector, and release-rails fixture.

Run the same domain/tool/workflow/recovery contract bytes without domain-code
changes across: commercial local bindings (GitHub App fixture, normalized OIDC,
self-hosted Postgres/Temporal/LiteLLM/MinIO/PostHog); regulated self-hosted
bindings (GitLab fixture, Keycloak, self-hosted Temporal, local vLLM through
LiteLLM, MinIO/PostHog/OTel); Mastra pinned adapter and direct Temporal fallback;
and primary/secondary S3-compatible adapters. Provider adapters may change; domain
and tool-registry hashes must not. OR-01 through OR-25 and WS-01 through WS-13
are the mandatory core-touching set; omissions fail.

## A14. Cross-tenant and existence-oracle matrix

Use indistinguishable tenants A/B. For human, registered agent, revoked agent,
worker/reconciler, CI, sandbox, and administrator, exercise read, list/search,
create, update, delete/expire, retry/replay, and indirect references at:

| Boundary | Required probes and outcome |
|---|---|
| API/UI/BFF/MCP | IDs, routes, cursors, export, tools, streams/reconnect: normalized denial, no payload/write |
| Postgres direct/pooled | all tables, local context, connection reuse, prepared statements/jobs: RLS zero/deny, context cleared |
| full-text/vector/memory | exact/prefix/typo/facet/count/snippet/page, filtered/unfiltered neighbor/recall: filter before rank, no hit/context |
| evidence/object store | list/head/get/range/presign/hash/overwrite/delete/version: no metadata/URL/mutation |
| model gateway/key/cache/budget | selection/fallback/quota/error/cache: no B key/prompt/response/budget/charge |
| Temporal | start/signal/query/cancel/reset/reused ID/recovery: no history/mutation |
| cache/session | guessed/direct key, eviction/shared cache, cookie/token swap: namespaced miss/deny |
| sandbox/readiness | mount/repo/secret/network/artifact/reuse: no B or host access; teardown |
| logs/traces/metrics/analytics | query/dashboard/exemplar/error/export: no content, cardinality, or timing leak |
| notifications | recipient/link/retry/template error: no recipient/content/link/send |
| Git/code-host | repo/ref/commit/review/status/signature/idempotency: deny before installation-token exchange/write |
| release/provisioning/cost | flag/deploy/provider request/budget/restart: deny before credential, external effect, or charge |

Every row must pass section 6.4 timing, byte-normalized response, authorization,
credential, side-effect, and cost-ledger agreement. Application filtering cannot
compensate for failed RLS or provider boundary.

## A15. Domain routing, technical release, and outcome contract

All seven domains are activated: security, privacy, accessibility, money, legal,
reliability, and irreversible operations. Each receives one current fresh-context
Builder-independent agent review containing identity/configuration, disposition,
confidence, exact revisions/digests, cases, evidence, findings, and every policy
trigger. Agents cannot suppress escalation, accept residual risk, waive controls,
or sign. Commercial human specialists enter on deterministic triggers; regulated
work retains the signed minimums in `kit/policy/gates.json`.

`technical-release-candidate` is true only when OR-01 through OR-25, WS-01
through WS-13, every section 5-14 matrix row, every evidence requirement, a new
exact-revision build Critic with zero findings, all release-domain reviews, all
triggered human records, and Gate 3 eligibility are green at one implementation
revision. Any failed, missing, stale, wrong-tenant, unavailable, or inconclusive
row fails. No waiver, average, rerun selection, or severity label makes it green.

Pilot activation freezes `T0`, pod, release, baseline, telemetry contract, and
production classification by signature. Baseline is the contiguous 90 UTC days
before `T0`; outcome is `[T0,T0+90 days)`. At least ten distinct `pilot-real`
post-`T0` items reach a signed release record; synthetic, fixture, demo, replay,
rehearsal, deleted, or merged-away items are excluded with lineage.

| Brief measure | Pass rule |
|---|---|
| gate wait | median from first server `decision-ready` at decided revision to first valid terminal decision is <=50% of like baseline; every pair present |
| zero manual status | no writable status field/path; 100% of observed transitions computed and zero manual write |
| centralization | >=90% of every eligible Gate 1/2/3/specialist terminal decision completed entirely in platform; missing journeys stay in denominator |
| human-hours guardrail | deduplicated attributable attention hours per included shipped item <= same-policy baseline |

Evidence retains pilot manifest, raw-event hashes, included/excluded lineage,
metric code/SQL revision, clock and missingness reports, numerators/denominators/
counts, and canonical verdict. Production/fixture stores use separate credentials
and destinations; validation proves zero fixture lineage. Full window, all four
measures, complete evidence, ten items, and Product Lead plus measurement-owner
human signatures are required. Agents may calculate but never sign.

## A16. Gate 2 pass condition and source coverage

This document is eligible for a human Gate 2 decision only after a new exact-
revision Critic reports zero findings; seven current green domain records and a
complete exception brief exist; HR-01 over the signed retention policy is
current; every other currently applicable human ruling is current; actor-bound CI passes the actual author and
diff; support and supplied-Exam digests match; and all Gate 1 artifacts remain
byte-identical. Eligibility is not a signature or authorization.

| Supplied source | Preserved cases |
|---|---|
| supplied 1-8 | OR-01 through OR-08 |
| supplied 9, 9a-9f, 10 | OR-09 through OR-16 |
| supplied 11-19 | OR-17 through OR-25 |
| Architecture ADR-17.1 through ADR-17.13 | WS-01 through WS-13 |

This annex candidate does not approve itself, dispatch a Builder, alter a gate record,
authorize a push, release, production use, paid service, deployment, or spending.

## Accepted HR-01 ruling binding

The qualified privacy/legal records owner accepted HR-01 in the provider-recorded human ruling at `intent/0001/reviews/domain/remediation/human-rulings/hr-01.json`, SHA-256 `ab24437ac426e1da759d6163afab0e1467bc9e19809a57e83566cc89cbd73074`, committed at `6c6d361617d5f3649c954cc43e79a37984517b6c`. The ruling binds the retention policy SHA-256 `271d4fa1ee2682f06e504e615cc9e8588ea34ff3ff7d5e2c27f245f80509c96c` and explicitly does not sign Gate 2 or authorize production, deployment, or spending. HR-02 remains untriggered for this commercial Gate 2 and fail-closed for any future regulated technical release or pilot activation.
