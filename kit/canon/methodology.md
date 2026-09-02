# STEER Methodology

Why a new way of working: the constraint, the values, and the principles

_Idriss Enayat · Framework v3.1 · September 2026_

This document states the reasoning behind STEER: the constraint shift that makes a new way of working necessary, the values it keeps from Agile, and the principles that govern every decision inside it. The Framework document defines the structure; the Operating Model document defines how organizations run it.

## The Constraint Shift

Delivery methodologies are answers to the binding constraint of their era. Waterfall answered a world where change was catastrophically expensive, so planning everything first was rational. Agile answered the constraint that followed: human coding capacity was scarce and expensive. Sprints ration that capacity, story points estimate it, standups coordinate it, and velocity measures it. For work that humans build, those remain the right answers.

That constraint is now dissolving. AI agents produce working implementations in hours, and the bottleneck has moved to the two activities that remain irreducibly scarce. Deciding: what should we build, and why, which is a human question about intent, users, and consequences. Verifying: is what the agent built correct, safe, and good, which is trust that must be earned per item, never assumed from a demo. Teams that keep the old machinery against the new constraint drift into theater (ceremonies wrapping work agents finish in an afternoon) or into unverified shipping at machine speed. Speed without trust is not velocity; it is debt.

Build time is no longer the constraint. Deciding and verifying are.

## The Values: Agile, Re-implemented

STEER keeps the Agile values and replaces the Scrum-era machinery, because the Manifesto never mentioned sprints or story points; that was implementation, built for human labor. STEER re-implements the same four values for agent labor:

- Individuals and interactions: a culture layer protects human judgment, dissent, and accountability while agents absorb process at machine speed. People do less ceremony, not less thinking.

- Working software: sharpened to working software with evidence. Tests, evals, and production telemetry over claims and status theater. Nothing ships on assertion.

- Customer collaboration: outcome contracts measured in production replace feature checklists negotiated up front. The customer's reality closes the loop, not the plan.

- Responding to change: continuous flow with hours-cheap rework, and a learning loop empowered to rewrite the operating system every turn.

STEER is Agile. It just isn't Scrum.

## The Five Moves

The methodology's thinking loop is five moves. Sense: gather signals continuously from users, production, and the business. Think: frame intent, choose a design, and define what provably done means before the work is done. Execute: let agents build at machine speed inside guardrails. Evaluate: verify with evidence, machines first, human judgment where it matters. Repeat: turn outcomes into a versioned decision and let the loop improve the loop. The moves are deliberately close to classic decision loops; what is new is the division of labor inside them.

The five moves. Repeat closes every turn.

## The Principles

- Agents do the labor, humans make the decisions: humans own intent, dissent, and legally binding accountability. Someone signs; that never transfers to an agent.

- Evidence over assertion: every claim carries its proof: test output, build logs, telemetry. A high pass rate against a weak check proves nothing, so every metric is paired with the one that keeps it honest.

- Independent verification: the check on the work is authored and owned independently of whoever (or whatever) builds it. The builder can never edit the check.

- Trust is earned, not assumed: autonomy is never assumed from a benchmark or a demo; it expands as a measured track record strengthens, and contracts when the record resets.

- Artifacts over meetings: the process ships as version-controlled files, and written artifacts, not meetings, are the interface between people, agents, and stages.

- Minimum sufficient judgment: human hours per shipped item trends down while outcomes and guardrails hold. Automation that raises human toil is a defect.

- Coexistence over conquest: Waterfall persists where phase gates are mandated; Scrum and Kanban remain right for human-built work. STEER competes only for agent-buildable work, and says honestly where it does not fit.

- Honesty by construction: claims wait for evidence, including claims about STEER itself. Adoption starts with a pilot whose output is data, not anecdotes.

## The STEER document set

- STEER Methodology (this document) · Why: the constraint shift, the values, the principles that govern every decision

- STEER Framework · What: the structure, the artifact chain, the plays, the gates, the metrics

- STEER Operating Model · How: accountabilities, decision rights, trust policy, culture, and scale

- STEER Practice Note 1 · Sizing and Scoping Work in STEER · How work is split, aged, and forecast

- STEER Practice Note 2 · Providing Intent · How natural language becomes a committed brief, spec, exam, and plan

- STEER Practice Note 3 · The Three Surfaces · How intents, in-flight work, and decisions protect human attention

The Guidebook is the complete reference; the Whitepaper is the shareable overview.
