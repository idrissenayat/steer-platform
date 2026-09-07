# Functionality and human UX review

Reviewed 2026-09-07 against the local Next UX preview. See
[`intent/0196/EVIDENCE.md`](../intent/0196/EVIDENCE.md) for exact scope and checks.

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
| Create and correct a Brief | Local editor, review and focused correction controls | Form-based; not the intended agent interview |
| Save and resume | Explicit browser save, backlog search and reopen | Unencrypted, same-origin/profile only; not Git or a backup |
| Recover from mistakes | Cancel discard/removal, missing-title feedback, save-failure retry | No undo after confirmed removal; no autosave |
| Consult the model | Eight canonical documents, local search, return to unsaved Brief | No actionable guide correction submission |
| Talk, correct, sign | Operating model and contracts specify the direction | Model-backed conversation and actionable signatures are not connected |
| Steer execution | Existing domain/runtime foundation | Verified Flight Board and Inbox inputs/actions remain unfinished |

## Next product work, in order

1. Validate the current draft/review flow with the user using sample content.
2. Build the architecture's agent-led conversation and live Brief summary with
   correction controls and explicit uncertainty. A local test double must be labelled;
   it cannot count as a working agent. Provider calls still need their prerequisites.
3. Connect reusable work surfaces to authoritative save/projection and decision
   contracts as J1–J4 become complete. Do not convert local samples into verified stages.
4. Demonstrate the full approved real-user journey, recovery and accessibility
   negatives in J6. Authentication configuration is deferred, not removed from scope.

The form is a testable authoring fallback, not a replacement for STEER's principle
that agents do the labor and humans provide intent, correct and sign. Remaining
dependencies are tracked in [`JOURNEY-REMAINING-WORK.md`](JOURNEY-REMAINING-WORK.md).

## Five-minute human test

1. Open [the local platform](https://localhost:8443/) and choose **Open UX preview**.
2. Create a sample intent with a title and desired outcome. Review it and choose an
   Edit control. Is it clear what to correct and what is still unknown?
3. Consult the operating guide, read a section and return. Your unsaved text should
   remain exact. Start another intent, then choose **Keep editing** or press Escape.
4. Choose **Save on this browser**, reload, reopen the preview and find your draft.
   Check that the reviewed words match what you saved.
5. Try the layout in a narrower window. Note anything hard to find, surprising,
   repetitive or requiring unnecessary human effort. Do not enter sensitive content.

Passing developer checks is not human usability acceptance or accessibility certification.
