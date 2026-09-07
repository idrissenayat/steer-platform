# Learn STEER in the Next workspace

After signing in, find **Learn STEER** and choose **Open guide**. The reader holds
the Methodology, Framework, Operating Model, three numbered practice notes,
Glossary and Guidebook from the repository's operational kit.

Select a document on the left. Use **On this page** to jump to a section, or search
for terms across the canon. Search runs locally, requires all entered terms and
shows up to 12 matching sections. Neither queries nor reading progress are stored
or sent to a model, analytics service or provider.

**Version and exact source** shows the kit label, canonical path, originating
source name, SHA-256 and original Markdown. The readable view uses the same kit
parser as the prototype; the exact source remains available for fidelity checks.
The kit label identifies the checkout used to build this application, not a verified
release tag or approval. Source links and images are inert; no document instructions
execute. Canon changes still go through kit governance, never this reader.

The outline remains beside the article on desktop and moves above it on narrow
screens. Keyboard selection focuses the destination heading. **Close guide and
return** restores focus to **Open guide**. Hiding the page clears the reading
selection and search; session expiry closes the guide and requires refreshed access.
This UI clearing is not secure erasure of previously delivered canonical bytes.

## Build contract

The web package scripts run apps/web/scripts/generate-learn.ts before dev/build
and standalone TypeScript checking (after Next route generation). Runtime start
does not load kit files. This produces an
ignored build intermediate, not maintained source.
Missing/oversized files, mismatched kit/manifest versions or changed fixed paths
fail generation instead of serving a stale generated fallback. Turbo includes kit
inputs in cache keys. Restart the development server after kit edits; rebuild the
application to deliver changed canon. No runtime repository reads or CMS are added.

## Still to implement

The complete intent/0004 also requires role-based orientation ending in real
operating actions, contextual glossary peeks, a governed correction-submission
flow, outcome instrumentation and qualified accessibility acceptance. None is
marked complete by this reader. The public whitepaper URL remains unconfigured.
No placeholder first-action link or invented completion event is supplied.

This development surface does not enable live saving, verify lifecycle state or
sign any gate. See intent/0192/EVIDENCE.md and docs/JOURNEY-REMAINING-WORK.md.
