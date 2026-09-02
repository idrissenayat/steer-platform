# Exam: Flight Deck Phase 1

Derived from: 0001-BRIEF.md and 0001-SPEC.md. Status: draft, pending
Gate 2 (Tech Lead signature after Critic findings resolved).
Domains: security and privacy and accessibility are default-closed; the
full exam below is approved before code for those areas. Builders cannot
edit this file; the exam-protection hook enforces it.

## A. The iron rule (truth cannot drift)

1. Given a fixture repo with a known artifact chain, the computed Flight
   Board state matches the expected state for every item, for every
   combination of: artifacts present, gates signed, checks green or red.
2. Destroy-and-rebuild: wipe all projections, replay events, and the
   rendered view is byte-identical to the pre-wipe view.
3. No-write invariant: a full crawl of the product's storage after a
   complete usage session contains no authoritative work-item state,
   no status fields, and no signature that is not also present in the chain.

## B. Decision inbox correctness

4. A user sees a decision card if and only if: the gate is ready, the
   user holds the signing accountability for the item's domain tags, and
   the gate is not already signed. Property-tested across generated cases.
5. Signing records identity, sequence position, and artifact revision in
   the chain; the recorded revision equals the revision displayed when the
   signer clicked. A revision change between render and click voids the
   action and re-presents the card (no stale signatures, ever).
6. Send-back routes to the correct state with the note attached and the
   gate remains unsigned.
7. Specialist cards appear only for tagged domains; SLA breach escalates
   visibly within one minute of the deadline.

## C. Evidence assembly (Gate 3 view)

8. The Gate 3 card presents, for the signed revision: exam pass/fail per
   case, Critic findings ranked with the nit cap applied, and plan
   conformance. Any evidence element older than the displayed revision
   renders as stale, never as current.

## D. Originator path

9. A scripted non-engineer session (problem description in, corrections,
   save) produces a committed BRIEF.md that validates against the kit
   template, attributed to the originator's identity, with zero git
   terminology in the visible flow (checked against a banned-term list).
10. Assistant eval set: 20 real originator prompts; every draft contains
    problem, proposed outcome, affected users/systems, constraints, open
    questions; zero hallucinated systems (names must resolve against the
    provided context). Eval suite reruns on any change to the assistant's
    prompt or template; a pass-rate drop blocks the merge.

## D2. Intent backlog and role home

9a. Pull is refused, with the limit shown, when the pod is at its WIP
    limit; the refusal is logged and no work item is created.
9b. The measurable-today badge is true if and only if the outcome
    contract's metric resolves against the connected telemetry store
    (fixture-tested both ways).
9c. Duplicate clustering: seeded near-duplicate intents group under one
    cluster with a correct count; unrelated intents never group
    (property-tested on generated corpora).
9d. Decay policy: an intent untouched past the configured window expires,
    is recorded as expired with its timestamps, and reappears only if
    redrafted by a new signal; nothing is hard-deleted.
9e. Declines record the reason and surface it to the Scout's tuning
    input; a declined intent's cluster does not re-notify for the
    configured cool-down.
9f. Attention hierarchy: with items present in all three panes, the
    default view order is inbox, then triggered candidates, then ambient
    flight; the flight pane emits no notification except a band breach
    (verified against a notification capture).

## E. Security and privacy (default-closed)

11. Token scopes: read plus approval-write only; a scope audit in CI fails
    the build if any broader scope is requested.
12. No secrets, tokens, or originator problem text in logs (log scrub test
    with seeded canary strings).
13. Webhook authenticity verified; replayed and forged events rejected
    (test vectors included).
14. Assistant data path: originator text is not retained beyond the session
    save except in the committed artifact; retention test verifies.

## F. Accessibility (default-closed)

15. Automated: zero critical or serious axe-core violations on every
    screen, enforced in the gauntlet.
16. Manual gate: keyboard-complete walkthrough of the entire decision flow
    (inbox to signed gate) and screen-reader pass on both card types,
    against the 81-checkpoint model, before Gate 3 on any new UI.

## G. Performance and operability

17. Decision inbox renders within 2 seconds at p95 against a fixture
    account with 50 pending decisions across 10 repos.
18. Event-to-board latency within 60 seconds at p95; reconciliation heals
    a dropped webhook within 10 minutes (chaos test drops 5% of events).
19. The whole service runs self-hosted from a container with no external
    SaaS dependency in the core path (regulated-profile smoke test).

## Pass condition

All cases green in the gauntlet; sections E and F additionally require
their human specialist signatures per the gate policy. First-pass rate
and escapes from this exam seed the platform pod's own trust ledger.
