# Spec: Flight Deck — Phase 0 and Phase 1

Derived from: 0001-BRIEF.md. Status: draft, pending Gate 1 signature pair.
Scope: Phase 0 (the kit) and Phase 1 (read model + decision inbox).
Later phases (gate engine hardening, trust ledger, loop console, portfolio)
are named for sequence only and are out of scope here.

## Design principles

1. System of engagement, not system of record. The platform is a projection
   of the artifact chain plus an authoring and signing surface into it.
   The iron rule from the brief is testable: destroy the cache, rebuild,
   get an identical view.
2. The home screen is the decision inbox. A human opens the platform and
   sees only the judgments waiting on them; everything else is ambient.
3. Roles are lenses, not permissions theater. One truth, five views:
   Product Lead (intent home, outcomes), Tech Lead (exams, evidence),
   Product Designer (design intent, shipped experience), Platform Engineer
   (fleet, hooks, costs), leadership (portfolio, north-star curve).

## Phase 0 — the kit (free, open)

The repository scaffold any team can adopt with no platform at all:
artifact templates (BRIEF, SPEC, EXAM, PLAN), gate policy file, guardrail
library structure, band config, metrics definitions, CULTURE.md, and CI
workflow examples that enforce the invariants (exam write-protection,
required checks, approval gates). The kit defines the file conventions the
platform reads, so every kit adopter is a future platform user and every
platform feature works against plain kit repos.

## Phase 1 — the read model and the decision inbox

### Read model
A projection service consumes code-host and CI events (webhooks; periodic
reconciliation as fallback) and computes, per work item: current Flight
Board state, artifacts present with revisions, gate status with signers,
evidence bundle (check results, Critic findings, coverage of the exam),
and per-play leading/lagging indicators. State is derived, cached,
disposable. No status fields exist anywhere in the product.

### Decision inbox
Per signed-in human, the list of decisions waiting on them, ranked by SLA:
- Gate 1 card: brief and spec side by side, flagged concerns surfaced,
  outcome contract highlighted, sign or send back with a note.
- Gate 3 card: diff summary, full exam results, Critic findings ranked
  with nit cap, plan conformance, canary plan. One authenticated click
  records the approval in the chain (review/status on the artifact
  revision). Send-back routes to Engineer with the note attached.
- Specialist card: appears only for tagged domains, shows the SLA clock,
  escalates visibly when breached.
Every signature records identity, sequence position, and artifact revision.
Nothing signs on the platform's own authority.

### Intent backlog (Product Lead home)
The selection surface, peer to the decision inbox. Each intent card shows:
problem, proposed outcome with a measurable-today badge, domain tags,
provenance (band breach with evidence, ticket cluster, named originator),
duplicate-cluster hints, and computed mission-fit against the pod's
quarterly brief. Four actions: pull into flight (blocked at the WIP limit,
which renders on this screen), decline with a reason (recorded; tunes the
Scout and bands), merge, send back one question. Untouched intents
auto-expire per the pod's decay policy; expiry is recorded, not deleted.

### Three-pane role home
Every accountability gets the same shape with role-specific content:
candidates pane, in-motion pane, decision inbox. Attention hierarchy is
enforced by design: inbox ranks first always; candidates surface on pull
triggers (open WIP slot, high-signal arrival); the in-motion pane is
ambient and never pushes except on band breach. No progress-polling
affordances exist: the bands watch flight, humans do not.

### Work item thread
Clicking any item opens one continuous view, brief to current state, with
CI results and review findings pulled in rather than linked out. Phase 1
pulls chat threads by link only; native channel ingestion is Phase 3.

### Guided brief authoring (originator path)
A non-engineer describes a problem conversationally; the platform drafts
BRIEF.md against the template, the originator corrects it, and save commits
to the intent home under their identity through the connector. No git
concepts are exposed. The drafting assistant is a bound model behind the
platform seam; its prompt and template are versioned in the kit.


## Organization layer (added 2026-09-02, per Operating Model v3.1)

### Structure and topology
Organization (tenant) → Portfolios → Products → Pods, plus an org-level
specialist pool. Each level is declared in versioned files in the
organization's operating repository (ORG.md, portfolios/*.md,
products/*/PRODUCT.md, pods/*.md, policies, the kit) and projected;
nothing structural is authoritative in the database. An item's chain
lives in its product's designated home repository, co-located with code.

### Roles and identities
Org Admin (identities, agent registration and revocation, gateway keys,
budgets, policy defaults), Portfolio Lead (signs mission briefs), Product
Steward (exists only when more than one pod shares a product), the four
pod accountabilities, specialists. Agents are registered identities
scoped to the organization and assigned like humans. Hats are explicit:
a person may hold any number; every signature records identity + hat.

### Inheritance
Fleet configuration, guardrails, gate policy, bands, and culture inherit
organization → product → pod. Overrides are versioned and eval-gated;
a lower level cannot weaken a default-closed domain set above it.

### Capacity per human
WIP limits roll up per person across every pod and hat. The platform
computes a personal attention budget and refuses pulls that exceed it.
Specialist SLAs span pods.

### Minimum distinct signers (gate policy)
Commercial defaults: default-open needs one human + a passing
fresh-context Critic; default-closed needs one human + Critic pass with
zero unresolved findings + the second-look rule (Gate 3 signed in a
separate session from Gate 2, after the Critic's report on the build).
Regulated profile: default-closed needs two distinct humans; the
platform states this constraint at onboarding, not at the gate.

### Stack Packs and readiness scan
The product profile selects a Stack Pack from the kit (Builder runtime
binding, language guardrails, exam templates, release-rails adapter,
starter context files). Connecting an existing repository triggers an
agent-readiness scan (tests, seams, secrets hygiene, CI, telemetry) whose
findings are auto-drafted as on-ramp briefs in the backlog.

### Day-one rules
Greenfield outcome contracts may use leading indicators until production
telemetry exists (the measurable badge gains a greenfield state). Trust
bootstraps from default policy: low-risk domains default-open from item
one; named high-risk domains default-closed. Mission fit renders as
unscored, never blocking, until a mission brief is signed.

### Handover and isolation
Accountability transfer is a recorded event: open gates re-render to the
new signer, past signatures stay attributed. Memory, keys, sandboxes,
and evidence are tenant-scoped; no cross-organization retrieval.

## First-run flow (agent-first onboarding)

The platform agent runs onboarding as a conversation; the interface
shows a live summary beside it. Every step is a tool call the human can
also make manually, but never needs to.

1. Human: "I'm building X." Agent asks two or three questions (solo or
   team, existing code or new, regulated or not).
2. Agent creates the organization, a portfolio, a product, and a pod;
   proposes hat assignments (solo: all hats to the user; team: from the
   names given) and the specialist pool.
3. Agent recommends a Stack Pack from the product brief it drafts; human
   confirms or changes.
4. Agent connects or scaffolds the home repository and the operating
   repository; runs the readiness scan if code exists; drafts on-ramp
   briefs.
5. Agent drafts the product brief, a first mission brief, and the first
   intents from the conversation; sets trust bootstrap tiers from the
   profile (commercial or regulated) and states any signer constraints.
6. One summary. The human reads, corrects, and signs once. The loop is
   live: talk, correct, sign.

## Architecture notes

- Bindings behind seams: code host adapter (one host first; seam contract
  published with Phase 1), CI adapter, identity (OIDC), model provider for
  the authoring assistant. No adapter type leaks into the core.
- Storage: event log + rebuildable projections only. Anything authoritative
  is written to the chain. Regulated-profile constraint honored now:
  the whole service runs self-hosted from a container; no SaaS-only
  dependencies in the core path.
- Accessibility: WCAG 2.1 AA acceptance in the exam for every screen;
  keyboard-complete decision flow; automated checks in the gauntlet plus
  the platform pod's own DHS Trusted Tester review at Gate 3 for new UI.

## Flagged concerns (for their policy owners, before Gate 1)

- Signature weight (legal/compliance): provider-recorded approvals may not
  satisfy the strictest audit contexts; decide whether the Phase 2 signed
  event log must be pulled into Phase 1 for regulated pilots.
- Single-host first binding (product): risks reading as vendor-specific;
  mitigated by publishing the seam contract with Phase 1.
- Notification design (UX): the decision inbox must never become a feed;
  push only on SLA risk, ambient otherwise. Attention is the product.
- Assistant boundary (privacy): the authoring assistant sees originator
  problem descriptions; data handling and retention need a policy line
  before the originator path ships.
