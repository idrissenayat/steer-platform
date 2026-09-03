# Architecture decision 0001: agent-first domain assurance

Status: accepted for Framework v3.2; implementation in progress  
Date: 2026-09-03

## Context

STEER is designed for agents to perform delivery and verification work while
humans retain intent, dissent, residual-risk acceptance, and authorization of
consequential external effects. Treating every activated domain as a routine
human signature created seven parallel human queues for the platform foundation.
That contradicted the minimum-sufficient-judgment principle and confused
independent assurance with human accountability.

## Decision

Every activated default-closed domain receives an independent, fresh-context,
revision-bound domain-agent review. The Builder cannot perform or edit that
review. The platform produces one consolidated exception brief containing every
domain disposition, confidence level, finding, evidence gap, and escalation
trigger.

For commercial work, the Tech Lead makes the Gate 2 decision over the Exam and
the consolidated brief. A human specialist is required only when one or more of
these triggers is present:

1. unresolved blocker or major finding;
2. missing or inconclusive required evidence;
3. requested waiver or policy override;
4. law, regulation, contract, or organizational policy requiring human review;
5. material rights impact or irreversible external effect;
6. manual accessibility validation for a user-facing release; or
7. production release, paid deployment, or spending authorization.

Regulated default-closed work requires a human specialist for every activated
domain and at least two distinct human signers. A lower-level configuration may
strengthen but never weaken these rules.

## Control invariants

- A missing, stale, self-reviewed, low-confidence, or inconclusive domain review
  blocks the gate; it never becomes a silent pass.
- An agent may propose escalation but cannot suppress a trigger, waive a
  control, accept residual risk, sign a gate, or authorize an external effect.
- The consolidated brief must link every underlying review and evidence hash;
  consolidation may not hide dissent or findings.
- Gate signatures remain human and bind verified identity, active hat,
  sequence, session, timestamp, and exact artifact revision.
- The Exam remains independently authored and protected from Builders.
- A budget ceiling is not spending authorization.

## Consequences

Routine domain analysis scales with the agent fleet rather than the number of
available people. Human attention concentrates on one accountable gate decision
and genuine exceptions. The platform must represent domain reviews separately
from signatures, compute escalation deterministically, and show the consolidated
brief before the gate action.

This decision supersedes the v3.1 interpretation that every activated
default-closed domain automatically creates a human specialist signature. It
does not weaken regulated separation, Gate 2 Tech Lead accountability, Gate 3
release accountability, or named production and spending authorization.
