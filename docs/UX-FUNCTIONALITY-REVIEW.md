# Functionality and human UX review

**Current direction, 0198:** the user wants the actual authenticated application,
not the separate local preview. The main page now uses the real free-text agent
conversation component. Live calls remain disabled pending budget and gateway
activation. See [the current workflow guide](INTENT-AGENT-WORKFLOW.md).
The review and five-minute preview script below are historical, not instructions
for the current primary route. Existing local records have not been deleted.

Reviewed 2026-09-07 against the local Next UX preview. See
[`intent/0196/EVIDENCE.md`](../intent/0196/EVIDENCE.md) for exact scope and checks.

**Subsequent user feedback, 0197:** the eight-question intake was rejected. New
intents now start with one open text box, not a form. Exact free text is retained
separately from old structured answers; titles are optional and field-count
checklists are gone. This change supersedes the form-based starting flow below.

## Outcome

The local draft-and-guide flow is testable without signing in. It is not yet the
complete STEER product journey. Tests of local saving do not prove GitHub saving,
agent execution, verified lifecycle transitions or human approval.

## Observed defects addressed

- Unsaved-work confirmation stayed inline without taking keyboard focus. A person
  could navigate to Learn while the old discard action remained active. Native modal
  confirmations now block background interaction, focus the safe choice, support
  Escape and restore focus to the opener. Explicit Tab wrapping keeps both choices
  reachable without dropping focus into browser chrome.
- Long Briefs moved the review/save actions out of reach. The toolbar now stays at
  the top of the scrolling view; field focus has clearance below it.
- Decorative field numbers were included in accessible textbox names. Labels now
  announce the question itself, with helper descriptions retained.

## Capability boundaries

| Human task | Current capability | Important limitation |
| --- | --- | --- |
| Capture and correct intent | Open text box, exact-text review and old-detail correction controls | No model-backed interview or Brief generation yet |
| Save and resume | Explicit browser save, backlog search and reopen | Unencrypted, same-origin/profile only; not Git or a backup |
| Recover from mistakes | Cancel discard/removal, missing-title feedback, save-failure retry | No undo after confirmed removal; no autosave |
| Consult the model | Eight canonical documents, local search, return to unsaved Brief | No actionable guide correction submission |
| Talk, correct, sign | Operating model and contracts specify the direction | Model-backed conversation and actionable signatures are not connected |
| Steer execution | Existing domain/runtime foundation | Verified Flight Board and Inbox inputs/actions remain unfinished |

## Next product work, in order

1. Validate the free-text draft/review flow with the user using sample content.
2. Build the architecture's agent-led conversation and live Brief summary with
   correction controls and explicit uncertainty. A local test double must be labelled;
   it cannot count as a working agent. Provider calls still need their prerequisites.
3. Connect reusable work surfaces to authoritative save/projection and decision
   contracts as J1–J4 become complete. Do not convert local samples into verified stages.
4. Demonstrate the full approved real-user journey, recovery and accessibility
   negatives in J6. Authentication configuration is deferred, not removed from scope.

The free-text capture is the starting surface, not a replacement for STEER's principle
that agents do the labor and humans provide intent, correct and sign. Remaining
dependencies are tracked in [`JOURNEY-REMAINING-WORK.md`](JOURNEY-REMAINING-WORK.md).

## Five-minute human test

1. Open [the local platform](https://localhost:8443/) and choose **Open UX preview**.
2. Write a sample intent naturally, without a separate title or checklist. Review it
   and choose **Edit your intent**. Are all your words retained and easy to correct?
3. Consult the operating guide, read a section and return. Your unsaved text should
   remain exact. Start another intent, then choose **Keep editing** or press Escape.
4. Choose **Save on this browser**, reload, reopen the preview and find your draft.
   Check that the reviewed words match what you saved.
5. Try the layout in a narrower window. Note anything hard to find, surprising,
   repetitive or requiring unnecessary human effort. Do not enter sensitive content.

Passing developer checks is not human usability acceptance or accessibility certification.
