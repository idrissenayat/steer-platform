# Brief: The STEER Platform — working name "Flight Deck"

Author: Idriss Enayat (Product Lead). Status: draft, pending Gate 1.
Naming note: "Flight Deck" is a working title pending the trademark search.

## Problem

STEER work today lives in six places: briefs in a repo, exam results in CI,
Critic findings in a PR, canary health in a dashboard, incidents in a chat
channel, metrics in a BI tool. Humans route around friction, so the process
erodes exactly where it matters most: at the decisions. Trackers like Jira
solve centralization by creating a second version of reality that humans must
maintain by hand, and that second version drifts into status theater. No
platform exists that gives STEER's humans one workspace while keeping the
artifact chain as the only truth.

## Proposed outcome

One centralized, role-aware workspace where humans steer: a decision inbox
that surfaces only the judgments only you can make, a Flight Board computed
from the artifact chain, and evidence assembled beside every signature.
The truth cannot drift because the platform stores none of it.

## Outcome contract (measured on the pilot pod, 90-day window)

- Gate wait time: median time from "decision ready" to "decision signed"
  falls 50% against the pre-platform baseline (from gate logs).
- Zero manual status updates: no human edits a status field, ever;
  board state is 100% computed (verified by design — no status field exists).
- Centralization: 90% of gate decisions made entirely inside the platform
  without opening another tool (instrumented per decision).
- Guardrail: human hours per shipped item on the pilot pod does not rise.

## Affected users and systems

Product Leads, Tech Leads, Product Designers, Platform Engineers,
non-engineer originators, portfolio leadership; version control and CI
(read + approval writes only), identity provider, telemetry store.

## Constraints

- Git remains the sole system of record. The platform renders, authors,
  and signs into the chain; it never stores state the chain does not hold.
  A destroyed platform cache rebuilds to an identical view.
- Vendor-neutral by seam: first binding may be a single code host, but
  every integration sits behind the platform seam defined in the framework.
- Role-aware, single workspace: each accountability sees their whole job
  in one place; non-engineers author briefs with no git or markdown exposure.
- Signatures are authenticated approvals binding identity, sequence, and
  artifact revision, recorded in the chain (commit status / review / signed
  event), never in a private database.
- Section 508 / WCAG 2.1 AA from the first release. Accessibility is a
  default-closed domain for this product.
- Regulated profile (self-hosted, managed policy layer) is a Phase 2
  commitment and a Phase 1 architectural constraint: nothing in Phase 1
  may assume SaaS-only operation.
- The platform is built using STEER: every feature enters as a brief,
  carries an exam, and passes the gates. Its own metrics are recorded
  from item one and are the pilot evidence for the framework.

## Domain tags

security (default-closed) · privacy (default-closed) ·
accessibility (default-closed) · integrations (default-open)

## Open questions

- Signature legal weight: is a provider-recorded approval sufficient for
  DCAA/FedRAMP audit contexts, or does the regulated profile require a
  cryptographically signed event log from day one?
- Which code host binding ships first, and does the seam contract get
  published with Phase 1 so a second binding can be community-built?
- Pricing boundary: which capabilities stay in the free kit versus the
  paid platform (candidate line: read-only board free; gates, trust
  ledger, and portfolio paid)?
