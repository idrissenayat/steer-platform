# Spec: Spec: Add 'Copy original intent' Button to Detail View

Derived from: `documents/intents/2d5970db-350b-4c9e-8ca8-0124a3142dda/BRIEF.md` at `a2f924fa05ceaf8d8c61fd8115c347ab717a47fd`
Status: draft

## Design principles

1. Non-disruptive enhancement: Button appearance must not modify existing reading UI or workflows.
2. Exactness: The copied data must exactly reflect stored original intent text and timestamp.
3. Accessibility: Full keyboard operability and screen reader semantics must be ensured.
4. Security & privacy preservation: No changes to authentication or approval flows.

These principles reflect the problem and outcome contract in the Brief.

## User journeys

### Primary journey

1. User opens the original intent detail view.
2. User sees a new button labeled 'Copy original intent' adjacent to the displayed intent text and timestamp.
3. User activates the button via mouse click or keyboard (focus + Enter/Space).
4. The exact original intent text and timestamp, formatted as specified, are copied into the system clipboard.
5. User optionally receives a subtle confirmation (e.g., tooltip or aria-live message).

### Failure and recovery journey

- If clipboard access is denied or unavailable, the UI gracefully informs the user that copying failed and may suggest manual selection.
- The button remains visible but disabled or with an explanatory tooltip if clipboard API is unsupported.
- On unexpected errors, allow the user to retry.
- Errors do not impact the existing reading view or application state.

## Architecture and seams

- Authoritative system per artifact: - Original intent data is authoritative from the existing backend or local store.
- The UI layer reads rendered intent text and timestamp from the detail view props or state.
- Adapter contracts: - UI adapter inserts a 'Copy original intent' button component in the detail view without altering existing UI layout substantially.
- The button triggers a copy-to-clipboard operation using the Web Clipboard API or fallback.
- Rebuild strategy: - Incremental frontend update; no backend or data model rebuilds required.
- Self-hosted core-path dependencies: - Relies on browser native clipboard APIs.
- No new self-hosted services or external dependencies needed.

## Accessibility

- Keyboard flow: - Button receives keyboard focus in the tab order after existing interactive elements.
- Activation via Enter or Space keys triggers copy operation.
- Screen-reader semantics: - Button has accessible name 'Copy original intent'.
- Uses <button> element or equivalent ARIA role.
- Announces success or failure via aria-live region.
- Automated checks: - Automated tests verify button presence, keyboard focusability, and clipboard behavior.
- Accessibility linters ensure ARIA roles and labels.
- Manual review owner: Frontend Accessibility Lead or QA engineer to validate keyboard and screen reader support post-implementation.

## Security and privacy

- Credentials and scopes: - No new credentials or scopes introduced.
- No authentication changes.
- Data classification and retention: - The copied data contains user-visible original intent text and timestamp, as already exposed.
- No additional data retention or logging changes.
- Webhook authenticity and replay defense: - Not applicable; no webhooks involved.
- Logging exclusions: - No changes expected in logging.

## Flagged concerns

- Concern, policy owner, and decision required before Gate 1: - UX product owner to approve final UI placement and label.
- Accessibility lead to approve keyboard and screen reader support.
- No additional security or compliance review needed due to no credential or data model change.
