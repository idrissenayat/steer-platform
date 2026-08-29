# STEER Operating Model

How organizations run it: accountabilities, decision rights, trust, culture, and scale

_Idriss Enayat · Framework v3.0 · August 2026_

This document defines how an organization runs STEER: who holds which decision, how autonomy is metered, what protects the human channel, and how one pod scales to a portfolio. The Methodology document states why; the Framework document defines the structure this model operates.

## Four Accountabilities, Signature Semantics

Agents do the labor; four humans own the decisions. On small teams people wear several hats, and the accountabilities are real regardless. What never transfers to any agent: intent, dissent, and legally binding accountability. Someone signs.

| Accountability | Owns | Signs |
| --- | --- | --- |
| Product Lead | What and why: pulls work into flight, owns the outcome contract, paces the system (the WIP limit is this person's protected attention) | Gates 1 and 3 |
| Product Designer | Design intent and the shipped experience | Gate 1; Gate 3 for user-facing change |
| Tech Lead | Correctness and the exam; judges what machines cannot | Gates 2 and 3 |
| Platform Engineer | The agent fleet, its guardrails, its cost; keeps machine speed safe | Fleet and hook changes (eval-gated) |

Specialists (security, accessibility, privacy, legal, reliability) plug in through three sockets rather than standing meetings: guardrails in the exam, a tuned domain agent, and a conditional gate seat that activates only for tagged domains, with written reviews under an SLA that escalates visibly rather than blocking silently.

## Trust-Metered Autonomy

Autonomy is a policy, not a mood. Gates tier by risk domain and by environment (development freely, staging in the middle, production behind a named authorization), and the tiering moves on evidence: first-pass verification rate and escaped defects form a measured track record per domain, environment, and agent role. As the record strengthens, default-open expands, signer counts drop, and human judgment concentrates on fewer, higher-consequence decisions. Model updates reset the relevant record; versions are pinned and the fleet re-validated on change. The floor is accountability: regulators, courts, and contracts bind humans, so someone always signs. This is also the model's answer to its own obsolescence: it meters improving AI at the rate trust is earned, so it strengthens rather than expires.

## Culture: The Human Channel

The model needs humans for judgment, dissent, and accountability, and it protects the channel that carries them in writing, because unwritten culture erodes at machine speed. Four commitments, shipped as a versioned culture file: two rooms by design (work rooms with agents are signed and on the record; every pod keeps a human-only room and one protected synchronous ritual; decisions on the record, doubts welcome off it); blameless by construction (the log audits artifacts and decisions, never individual fallibility, and no gate signature is ever used against its signer when the process was followed); cohesion as scheduled work (the huddle and the learning review are the team's social fabric, and the Product Lead's load is a named risk); and learning in public (judgment happens in shared rooms, which is how the next generation of decision owners grows).

## Scale: Two Speeds

Business alignment happens at discussion speed; delivery runs at machine speed, and the two are deliberately decoupled. The portfolio issues quarterly mission briefs per pod, naming outcomes to move and guardrails to hold, and manages no items. Each pod is a complete STEER loop: four accountabilities, a fleet, a Flight Board, gates, and metrics. Versioned interface contracts protect the seams between pods; shared libraries carry design systems, guardrails, and agent patterns; a platform pod treats the agent platform as a product. There is no lead pod: pods grow by cell division, copying the operating system faithfully.

The portfolio aligns quarterly; pods deliver continuously behind interface contracts.

## Portability and Governance

The model is vendor-neutral by construction: any capable model, any agent runtime, any code host, with every pick a binding behind a seam. Agent roles are hats on runtime primitives (interactive sessions, scoped subagents, non-interactive CI jobs), not separate products. In regulated environments one seam is mandatory: a managed, non-overridable policy layer (permissions, sandboxing, gate hooks) owned by the platform team. Governance is native rather than bolted on: the artifact chain is the audit record, and the mechanics map onto NIST AI RMF (gates and eval-gated change control implement Govern; briefs and outcome contracts, Map; the exam and paired metrics, Measure; guardrails, bands, and the learning review, Manage), giving ISO/IEC 42001 auditors a management system they can walk through. The Gate 3 signer owns the ship decision, and the fleet itself is treated as an attack surface: scoped credentials, sandboxed execution, dependency scrutiny, and model pinning with re-validation on change.

## Providing Intent

Originators provide judgment, not document labor. They begin with natural language in whatever form they have, and an intake agent interviews backward from the brief template. The agent provides structure; the human provides truth. The originator corrects a rendered draft in plain language and never needs to see Git, Markdown, or the underlying template. Save commits the accepted draft under that human's identity.

Four rules govern the interaction: interview rather than form; never invent missing facts; surface ambiguity as an open question; and promote a repeated human correction into versioned context after the second occurrence. System names must resolve against real organizational context. A plausible but unverified detail is a drafting defect, not helpful completion.

The same division of labor continues through the chain. The brief is an interview, the spec is a dialogue over two or three options and trade-offs, the exam presents machine-checkable cases as meaning for a human to judge, and the plan is interrogated conversationally before dispatch. Every entry point normalizes into one intent home, while humans retain every consequential choice and signature. See STEER Practice Note 2, Providing Intent, for the complete interaction model.

## Protected Attention: The Three Surfaces

An intent is a candidate; a work item is an intent the Product Lead has pulled into flight. The pull is the commitment boundary. Machine-speed intake may draft many candidates, but only a human pull may spend scarce framing capacity, and the visible WIP limit can refuse that pull.

The role home protects attention in a fixed order: decision inbox first, candidates only on a pull trigger, and work in flight as an ambient projection. Flight creates no progress notifications; only a breached aging band calls for a huddle. Declines retain a reason, untouched candidates expire without deletion, and mission fit informs rather than decides.

Every accountability receives the same three-surface shape with role-specific content. Roles remain lenses on one artifact-chain truth. See STEER Practice Note 3, The Three Surfaces, for the complete daily operating and platform-design guidance.

## Adoption

Start with one pod and a strict pilot posture: ten to twenty real items through the loop, metrics recorded from item one, before any broad claim. Adopt plays in dependency order, not stage order: the intent home and context files first, the exam and feedback loop next, review and gates before any automation, and the self-feeding loop last, because automation must never accelerate work through a gate that does not yet exist. Legacy systems enter through an agent-ready on-ramp (characterization tests, seams, guardrails, telemetry) run as its own sequence of briefs, and where an existing tool already holds a record, one system is named the source of truth per artifact and the other links to it.

## The STEER document set

- STEER Methodology · Why: the constraint shift, the values, the principles that govern every decision

- STEER Framework · What: the structure, the artifact chain, the plays, the gates, the metrics

- STEER Operating Model (this document) · How: accountabilities, decision rights, trust policy, culture, and scale

- STEER Practice Note 1 · Sizing and Scoping Work in STEER · How work is split, aged, and forecast

- STEER Practice Note 2 · Providing Intent · How natural language becomes a committed brief, spec, exam, and plan

- STEER Practice Note 3 · The Three Surfaces · How intents, in-flight work, and decisions protect human attention

The Guidebook is the complete reference; the Whitepaper is the shareable overview.

