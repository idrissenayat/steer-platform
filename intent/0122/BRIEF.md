# Brief: Guided authoring and correction preview

## Problem

0121 exposes a stateless Brief-preview tool, but the production workspace cannot
use it. The signed platform Brief and `kit/policy/intent.json` require an interview,
not a long intake form or raw Markdown editing.

## Proposed outcome

A signed-in synthetic human answers one question at a time, reviews an inert
rendered draft, corrects prior answers and sees the exact updated fingerprint.
Unknown facts remain visible. Nothing is saved, confirmed or signed.

## Scope

Reuse the pink/orange tokens, portable schemas, same-origin transport and safe
Markdown renderer. This is deterministic guided preview, not completed Mastra/model
conversation, verified system-name context, accepted confirmation or live Git write.
No provider permissions, frozen artifacts or gate approvals change.
