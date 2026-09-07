# Development evidence — 2026-09-07

Base: `3449dc22fabcc0b8eb2381cb57e602ce3ae43c2c`.

The user rejected the eight-question intake. The local new-intent screen now has
one free-text composer, no required title, no missing-field checklist and no progress
score. Review keeps the original words separate from preserved old Brief fields.

## Checks

Node 24.20.0: web suite 92/92, architecture controls 8/8, typecheck and production
build passed. Kit validation passed for 95 artifacts; token-scope audit and diff
whitespace check passed. The initial build caught an unchecked array index in the
title fallback; it was corrected with optional indexing, not a relaxed compiler rule.

Actual-component tests cover a single textarea/no title input, empty validation,
16,000+ character notes, exact guide return, clearing stale validation after editing,
save failure preserving text, retry, auto-label, inert review and reopening. Storage
tests cover both record versions, 100,000-character acceptance, oversized/extra/malformed
data rejection, old-data read without mutation, explicit upgrade and stale conflicts.

## Actual HTTPS UI

- New intent showed one labelled textarea and zero other inputs. Saving an empty
  intent focused the box and explained how to start.
- Typed a clearly labelled, non-sensitive UI DEMO free-form sample with paragraph
  breaks. Review displayed the exact text without an invented summary or approval.
- Consulted the guide and returned, saved, reloaded, reopened the preview and opened
  the automatically labelled sample. All original wording and paragraph breaks matched.
- At 390×844, the composer was a single full-width field below the reachable toolbar.
  Observed document width 375 was within viewport 390. Screenshot inspected; viewport
  reset afterward. This is not a physical-phone or virtual-keyboard verification.
- The earlier sample remained in the backlog. No existing record was deleted.
  Final-build opening confirmed all its old Brief answers remained exact. An empty
  save followed by typing cleared the obsolete validation error. A clean new composer
  is left open; `/tmp/steer-0197-ux.kRNvKF/composer-ready.png` was captured and inspected.
  The automation's empty-string fill did not clear the temporary input; normal
  Select All → Backspace did, with zero characters, clean state and no discard modal.

An observed empty-save message initially remained after typing; input now clears it,
with a regression assertion. No broad error handling or storage rules were loosened.

Only the two owned STEER frontend processes were restarted for shared-output builds.
The unrelated IPv6 port-3000 household server, database, Keycloak and volumes were
left untouched. Trusted HTTPS responds successfully; startup still says GitHub saving
disabled. Unrelated untracked roadmap/outputs remain untouched.

## Limits and follow-through

Device dictation is suggested as user-controlled OS input, not tested STEER speech
recognition. No audio recording, microphone control, model call or live conversation
was added. No generated Brief is claimed. The existing authenticated deterministic
authoring component is unchanged; this implements the user's current local UX priority.
Its eventual replacement must follow the same free-expression/agent-clarification
design instead of reintroducing required intake questions.

No all-package/full-control-suite run, qualified accessibility audit, gate decision,
provider grant, GitHub runtime save, deployment or spend. Live conversation, authoritative
saving and user UX acceptance remain open.
