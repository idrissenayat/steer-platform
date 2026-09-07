# Development spec

- One explicit Preview action reads only the existing curated path/revision/digest
  tuple through the current Brief reader and its server-side grant rechecks.
- Display only one selected summary at a time. Show its source title, exact Problem
  and Proposed outcome excerpts, source revision and a clear unverified-source label.
- Retain literal source text; do not execute HTML, activate links/media, infer claims
  or generate an AI summary. Reject inconsistent source offsets/bodies; never select
  one among duplicated sections. Missing, empty and unsafe structure remain distinct.
- Bound each excerpt to 1,600 UTF-16 code units without splitting a surrogate pair;
  visibly mark truncation and direct the reader to the existing full Brief control.
- Clear summaries on new reads, refresh, page changes, page hiding/navigation,
  scope/session changes, expiry and failures. Suppress late results after disposal.
  Clearing requires no network request or persistent browser state.
- Preserve the pink/orange palette, keyboard access, narrow layout, enlarged text,
  exact revision links, full dialog and current read-only authority boundaries.
- No deployment, provider access, schema, dependency, protected edit or live writer.
