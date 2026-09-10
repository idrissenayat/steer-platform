# 0311 — Generation read phase contract

1. The owned development-history constructor exposes a server-only
   `withGenerationRead` computation. The actual factory binds it to preview through
   an explicit `generationRead` dependency naming the exact public history method
   and records configuration. It is not a tool, browser field, authority claim or
   environment switch. Missing capability preserves the existing path; malformed,
   replaced or failed capability never triggers fallback.
2. Enter only after the current draft and save review have been validated. Read
   the exact retained development and independently authorized referenced scope
   once with the canonical record/content/SDK owners. Return an immutable private
   pair: the original historical snapshot and existing public history DTO. Preserve
   both roles, predecessor/result digests, profiles, exact source, expiry and all
   false execution/retry/gate/semantic-quality flags.
3. The read callback is limited to that invocation and target. Each consumption
   checks the current caller and separate original/result/scope source policies.
   No permission result, mutable record or source grant is cached across reads or
   requests. Reusing immutable verified content within this read-only phase does
   not authorize an effect or a new model attempt.
4. After dependent preview reads finish, recheck BOTH actual records/key leases,
   then original/result and scope source policies, followed by final caller checks.
   The encompassing corpus session still performs its final source closure. Any
   late key/policy/revision/source/lifecycle change withholds the preview. Source
   and destination checks are not removed. Confirmation still enters a fresh
   preview for every separate validation phase; no admission/persistence/scheduler
   or publication effect is enclosed by this computation.
5. Reject escaped, overlapping, unconsumed and caught-failed read callbacks.
   A forgotten unfinished read is drained before the phase can finish. Private
   composition waits for the owner's actual drain after public cancellation;
   public history can still reject promptly while shutdown waits for pending work.
   Four-call admission, existing 30-second history/60-second preview bounds and
   monotonic lifetime checks remain. Never extend deadlines to obtain a pass.
6. The existing fallback preview remains covered and public HTTP/MCP output and
   error contracts remain unchanged. No raw original or private callback enters
   the tool registry. The factory's public service inventory still exposes only
   `intent.development.history` read and the existing candidate preview action.

## Required verification

- Explicit/private binding checks, wrong configuration or method, replacements,
  lazy phase entry and no fallback SQL/original/public-history reads.
- Native owned pair equals established history; repeated reads use initial key
  material once per provider and final key readback only after dependent work.
  Deny late record/key/revision/source loss, parallel/skipped reads and closure.
  A held forgotten read must keep the actual phase pending until it drains.
- Real constructor/HTTP/SQL/recorded-SDK/Temporal synthetic default and continuation
  journeys, including corrected drafts, confirmation, fixed one-save execution,
  lost acknowledgements, restart and exact reopen. No live model or runtime save.
- Native unbound/expired/clarifying/uncertain history regression, types, focused
  tests, architectural boundaries, broad regression, prototype and kit/scope audit.

Report actual request reductions honestly even if small. Remaining surrounding
review/preparation/destination and effect controls must meet the unchanged C22
whole-action protocol: at most 200 attempts, 20 ms each, five-second p95, 20 warm +
3 cold + 4 concurrent samples in both directions, including negatives. No smoke
sample, historical source hash, new test count or commit earns a checklist point.
