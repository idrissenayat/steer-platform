# STEER Framework

What the structure is: the artifact chain, the plays, the gates, and the metrics

_Idriss Enayat · Framework v3.1 · September 2026_

This document defines STEER's structure: the organization topology, the layers, the artifact chain that forms the lifecycle's backbone, the eight plays, the three gates, and the measurement system. The Methodology document states why; the Operating Model document defines who decides and how organizations run it.

## Three Layers

The framework layer holds principles, accountabilities, gates, and metrics, and changes rarely. The lifecycle layer holds the eight plays across seven operational states, and is the daily rhythm. The platform layer holds agents, evidence, automation, and telemetry as bindings behind seams, so any tool swaps like a feature rather than a migration. Written artifacts are the interface between all three: the entire process ships as files in a repository, versioned like code.

Three layers: the framework changes rarely; the platform swaps like a feature.

## Organization Structure

STEER projects a versioned organization → portfolio → product → pod topology, with an organization-level specialist pool. The operating repository declares governance and inheritance; each product names one home repository for item chains. Org Admins manage tenant identities, agents, keys, budgets, and defaults; Portfolio Leads sign mission briefs; Product Stewards exist when multiple pods share a product; the four pod accountabilities run the loop.

People and agents are identities assigned to explicit hats. One person may hold every hat. Capacity rolls up per human across pods and hats, while tenant boundaries isolate memory, keys, sandboxes, and evidence. Stack Packs make product stack choices operational, and readiness scans turn brownfield gaps into on-ramp briefs.

## The Artifact Chain

Every play ends by committing an artifact to version control, and the next play begins by reading it. The chain is the audit trail: who asked for what, what the agents produced, what the evidence showed, and who approved it.

BRIEF → SPEC → EXAM → PLAN → diff + evidence → review findings + signatures → release record → band log → learning decision → next BRIEF

The brief states intent, its measurable outcome contract, and the risk domains it touches (it is a superset of emerging intent-file conventions, so STEER interoperates with intent-driven toolchains). The spec is the design pass. The exam, STEER's addition to the industry chain, is the binding definition of provably done: acceptance tests, evals, and guardrails, authored independently of the builders. The plan is the implementation route an agent proposes in a read-only pass. Then the diff with its evidence, the review findings with their signatures, the release record, the production band log, and the versioned learning decision complete the turn. A breached control band writes the next brief, so the loop can start itself.

The Flight Board: eight plays, seven states, three gates on the chain.

## The Three Surfaces

An intent is a candidate brief in the intent backlog. It becomes a work item only when the Product Lead pulls it into flight against the visible WIP limit for the responsible human across every pod and hat they hold. This boundary absorbs machine-speed supply without allowing it to flood human-speed judgment.

Every role home preserves the same attention order: the decision inbox for what needs judgment now, triggered candidates for what could enter next, and an ambient in-motion pane watched by aging bands. The platform projects these surfaces from the chain; it stores no private status. See STEER Practice Note 3, The Three Surfaces.

## The Eight Plays

| Play | Commits | What happens | Measure (leading · lagging) |
| --- | --- | --- | --- |
| 01 Sense | draft BRIEF | Signals, tickets, and band breaches become draft briefs; the Product Lead pulls work into flight deliberately (WIP is personal framing capacity across pods and hats) | signal-to-brief time · brief survival rate |
| 02 Frame · Intent | BRIEF + SPEC, Gate 1 | Intent accepted with a measurable outcome contract and domain tags; design pass with concerns flagged to policy owners | draft-to-accepted time · rework after build starts |
| 03 Frame · Exam | EXAM, Gate 2 | Test agent drafts the exam; a fresh-context critic attacks it; timing tiers with risk; builders can never edit it | spec-to-exam time · escaped defects per item |
| 04 Engineer | PLAN, then diff + evidence | Read-only planning pass, then builders implement in isolation; every claim ships with its proof; sessions verify their own work | first-pass rate · rework cycles |
| 05 Evaluate | PR + findings, Gate 3 | The gauntlet runs the full exam; a fresh-context critic reviews in ranked passes; humans judge intent, quality, consequence | time to first review · caught vs escaped |
| 06 Release | release record | Flag, canary slice, thresholds, rollback armed; autonomy tiers by environment; production requires a named authorization | gate wait time · change failure rate |
| 07 Observe | band config + breach log | Deterministic control bands with tiered response: log, diagnose read-only, propose through a gated route | breach-to-brief time · repeat incidents |
| 08 Learn | learning decision | Versioned decision (adapt, continue, scale, rollback, stop); incidents become permanent evals; changes to the operating system are eval-gated | incident-to-eval time · human hours per item |

## The Three Gates

Flow stops for a human signature at exactly three points; everything between them moves at machine speed. Gate 1: what are we building, and why. Gate 2: what does provably done look like. Gate 3: does the evidence support release. Each signature is an authenticated approval binding identity, active hat, sequence position, and artifact revision. Gates tier by risk domain and operating profile. Commercial default-closed work requires a passing fresh-context Critic, zero unresolved findings, and a separate-session Gate 3 second look. Regulated default-closed work requires two distinct humans. One invariant never tiers: the agents that build can never edit the exam.

## Measurement

Activity metrics are retired: velocity, story points, and utilization measure typing, and typing is no longer scarce. Four numbers run the framework, each paired so it cannot be gamed in isolation: outcome impact against the brief's contract (with baseline, denominator, and observation window); first-pass verification rate, read only alongside escaped defects; escaped defects, each one becoming a guardrail; and the north star, human hours per shipped item, trending down release over release while outcomes and guardrails hold. Every play also carries one leading and one lagging indicator, so the loop is measured everywhere it can drift.

Greenfield products may use explicit leading indicators until production telemetry exists; these render as greenfield rather than falsely measurable. Human hours per item trend to the accountability floor while guardrails hold.

## Sizing and Scoping

STEER sizes ambiguity, not agent effort. At Frame, a brief is right-sized only when it can be expressed as one outcome, one independently authored exam, and one coherent shape. If the exam cannot be written crisply, split the brief before Gate 1. Scope then freezes at Gate 1: a new want must return as a revision through the gate or become a new brief.

Engineer adds a second alarm: a plan that sprawls across roughly twenty files and four systems is a signal to split at a user path, domain tag, interface seam, or legacy on-ramp. Builders implement to the signed exam and cannot expand or edit it.

Forecasting uses cycle-time percentiles by brief shape, normally the 85th percentile, while aging replaces sprint rollover: each Flight Board state has a historical cycle-time band, and a breach escalates to a huddle. Real deadlines enter the brief as constraints, never as estimates. See STEER Practice Note 1, Sizing and Scoping Work in STEER, for the complete operating guidance.

## The STEER document set

- STEER Methodology · Why: the constraint shift, the values, the principles that govern every decision

- STEER Framework (this document) · What: the structure, the artifact chain, the plays, the gates, the metrics

- STEER Operating Model · How: accountabilities, decision rights, trust policy, culture, and scale

- STEER Practice Note 1 · Sizing and Scoping Work in STEER · How: exam-writability, scope alarms, aging bands, and percentile forecasting

- STEER Practice Note 2 · Providing Intent · How: interviews, rendered drafts, open questions, and meaning-first approval

- STEER Practice Note 3 · The Three Surfaces · How: intent backlog, pull boundary, role home, and protected attention

The Guidebook is the complete reference; the Whitepaper is the shareable overview.
