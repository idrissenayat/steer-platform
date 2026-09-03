# STEER platform implementation

This branch implements the Phase 0 kit and a validated UX/domain prototype
toward Phase 1 against a rebuildable fixture connector. The production Phase 1
foundation is defined in `intent/0001/ARCHITECTURE.md`; it is not yet
implemented. The proposed Gate-bound route is sequenced in
`intent/0001/PLAN.md`; that read-only planning draft does not authorize the
production migration.

The first bounded production increment now exists under `intent/0005`: a
pnpm/Turborepo workspace and Next.js App Router shell. Root `pnpm check` covers
both it and the unchanged Vite prototype. This is repository-foundation
evidence only; no provider, database, workflow, or production feature has been
claimed.

Item `intent/0006` moves the existing domain modules into `@steer/domain` and
migrates every prototype/test consumer to package imports. The package has no
runtime dependency or vendor SDK, typechecks independently under the stricter
shared baseline, and remains covered by the original characterization suite.

## Implemented

- deterministic artifact-chain projection and dropped-event reconciliation;
- role-aware decision inbox with conditional specialist seats and SLA state;
- Gate 1 intent/spec comparison, Gate 2 exam review, and Gate 3 evidence view;
- revision-safe sign and send-back actions that bind identity and sequence;
- continuous work-item thread from brief through evidence and signatures;
- guided non-engineer brief authoring with deterministic validation/revision;
- an interview-first originator experience with rendered draft correction,
  context-resolved system names, and no raw artifact exposure;
- a three-surface role home ordered as decision inbox, triggered candidates,
  and ambient flight, with a person-level WIP gate across pods and hats;
- a conversation-first setup agent that proposes organization, portfolio,
  product, pod, all explicit human hats, a tenant-scoped agent identity, Stack
  Pack, readiness findings, and the applicable signer constraint for one human
  correction-and-signature moment;
- versioned organization policy and declaration templates, default-closed
  inheritance enforcement, recorded accountability handover, and tenant-scope
  checks for agent identities and evidence;
- commercial and regulated minimum-distinct-signer policy, including the
  fresh-context Critic, zero-unresolved-findings, and separate-session Gate 3
  second-look requirements;
- a concrete TypeScript/React Stack Pack and a five-part repository-readiness
  scan whose findings draft on-ramp briefs;
- greenfield outcome-contract state and mission-fit-as-unscored behavior until
  a mission brief exists;
- an in-place rendered intent-detail panel with revision-safe actions,
  provenance evidence, clusters, history, and outcome instrumentation;
- one versioned, privacy-checked instrumentation contract for backlog actions,
  deliberate source exits, Learn navigation, first login, and first completed
  action, with deterministic baseline computation and minimum-sample refusal;
- a repository-sourced Learn STEER hub with version-aligned canon pages,
  section search, glossary peeks, stateless role orientations, and agent slices;
- a live scope check for one outcome, one exam, and one coherent shape, plus
  plan-sprawl alarms and split guidance;
- P85 cycle-time forecasting and aging-band domain functions;
- pilot telemetry for wait time, centralization, and human effort;
- Phase 0 templates, gate policy, guardrails, bands, metrics, culture, seams,
  and an EXAM-protection hook;
- webhook HMAC/replay controls, scope audit, log scrub, and ephemeral assistant
  retention control;
- automated structural accessibility and performance checks; and
- a self-hosted static container with security headers and health endpoint.

The source for this behavior is `STEER-Sizing-and-Scoping.docx` (Practice Note
1). Its rules are mirrored in `kit/policy/sizing.json` so the platform and the
adoption kit enforce the same operating model.

`STEER-Providing-Intent.docx` (Practice Note 2) defines the intent interaction
model. Its no-invention, ambiguity-surfacing, rendered-draft, correction, and
identity-binding rules are mirrored in `kit/policy/intent.json` and the guided
interview domain.

`STEER-The-Three-Surfaces.docx` (Practice Note 3) defines the intent/work-item
pull boundary and protected attention hierarchy. Its candidate controls,
measurable-today rule, decay record, WIP refusal, and notification boundaries
are mirrored in `kit/policy/surfaces.json` and the intent-backlog domain.

`STEER-Operating-Model.docx` now integrates the v3.2 agent-first assurance model. Its
organization topology, solo and agent-first commitments, repository model,
policy inheritance, person-level capacity, signer rules, Stack Packs,
readiness scan, greenfield state, handover, isolation, and first-run flow are
mirrored in `kit/policy/organization.json`, the organization domain, the setup
agent experience, domain-agent review routing, and the v3.2 Learn corpus.

All six root Word documents and their Learn projections are aligned to
Framework v3.2. `DOCUMENTATION-MAP.md` records the authority order, the v3.2
rule-to-implementation trace, and the synchronization procedure for future
doctrine changes.

## Current boundary

The supplied item chains are preserved under `intent/0001` through
`intent/0004`; the revised 0001 Brief and Spec replace their prior revisions
byte-for-byte. `kit/metrics/events.schema.json` is the operating event
contract for item 0002; `kit/metrics/baselines.json` deliberately records the
production baselines as pending instead of substituting fixture figures.

The browser preview uses the fixture connector and pilot identities. It proves
the interaction and domain contracts without requesting credentials or making
external writes. Production completion requires Gate 2 and Gate 3 records,
OIDC configuration, a live code-host/CI connector, triggered specialist manual
accessibility evidence, and pilot outcome data. See `INTENT-COMPLETION.md`.

Gate 1 is recorded at `intent/0001/signatures/gate-1.json` for the exact
`281c9736816ec22fa1209b060b58fa8164519f7c` artifact snapshot. It approves the
GitHub App, normalized-Keycloak OIDC, commercial provider-recorded approval,
regulated signed-log, self-hosted PostHog, and portable-container decisions.
It does not authorize spending: paid infrastructure requires a separate human
approval and may not exceed the stated pilot ceiling.

The first fresh-context Gate 2 Critic returned HOLD / SEND BACK. The authorized
Test Agent GitHub App has published a replacement canonical Exam at
`118302e080598a147294e32d40cf5296763c8cc4` that binds the accepted
Gate 1 snapshot, preserves the supplied Exam as historical source, incorporates
all original and walking-skeleton cases, freezes reproducibility requirements,
and adds complete tenancy, signature, outcome, and specialist matrices. The
actor-bound GitHub workflow, deny-by-default author policy, CODEOWNERS map, and
regression tests are operational on protected `main`. Live pull requests
against the exact numbered Exam verified that the human Builder is rejected,
the Test Agent App is accepted by CI, and one human CODEOWNER approval is still
required. This control evidence is not a Gate 2 signature. Seven domain-agent
review packets are bound under `intent/0001/reviews/domain`; their independent
reviews, consolidated exception brief, any triggered human escalations, and a
new exact-revision Critic remain outstanding. The repository now includes a
machine-readable domain-review record schema and a fail-closed consolidation
command. It verifies every bound artifact from the exact Git revision, rejects
missing, stale, self-reviewed, low-confidence, or under-escalated records, and
produces one JSON and Markdown exception brief only after all seven records are
present.

The production foundation still to be built includes the Hono API and typed
tool registry, MCP v2 transport, GitHub App adapter, Postgres/Drizzle/RLS
projections, Temporal workers, version-pinned Mastra adapter, LiteLLM gateway,
OIDC, tenant-scoped evidence storage, product analytics, a secret-manager seam,
and the thirteen-case architecture walking skeleton. The pnpm/Turborepo
monorepo, Next.js shell, and provider-free domain package already exist.

## Local commands

```sh
pnpm install
pnpm check
pnpm domain-reviews:verify-target
pnpm domain-reviews:consolidate
pnpm dev --port 4175
```

`pnpm check` validates the adoption kit and CI scopes, typechecks, runs the
gauntlet, and produces the production build. Domain review consolidation is a
separate gate command because it must fail until all seven independent review
records exist; an incomplete review set must not break ordinary development
checks or silently become an approval.
