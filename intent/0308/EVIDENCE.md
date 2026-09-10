# 0308 — Application corpus integration

The actual API constructor now uses the owned native batch graph for source review,
scope preparation and development preparation. Unknown code-host implementations
retain their existing collector contract; native failures do not fall back. No
browser flag, new profile, preview app or model transport selects this behavior.

## Behavior and safety

- Native current evidence preserves source IDs, target IDs, selection fingerprint,
  exact full Brief/Spec bytes and the existing envelope. Valid 34-source output
  matches the previous collector exactly, including candidate/amendment lineage.
- Missing, inaccessible, unresolved, malformed and initially denied sources remain
  explicit incomplete-search warnings. Restricted names and content do not escape.
  Pointer/manifest/Exam integrity still gates candidate/amendment inclusion; Exam
  bodies are not passed into semantic source review. Retained history stays strict.
- Loading starts at the service's first evidence read, after its preceding draft
  validation. A wrong draft revision cannot trigger repository prefetch.
- Immutable bytes are shared only inside one trusted read-only service phase.
  Caller, permission revision, selections, every consumed source and branch head
  close that phase after dependent work. Effects stay outside it; preparation and
  confirmation retain independent phases before and after persistence.
- The application owns work even before first evidence consumption, and keeps
  admission until the exact nested graph drains after public cancellation. Its
  consumer may finish before final source checks; that does not retire the caller
  check prematurely. Factory shutdown drains native graphs before owned resources.
- The package audit found earlier 0306/0307 composition outside declared import
  boundaries. History implementation now lives at the existing API runtime root,
  through explicit data exports; its old internal entry is only a compatibility
  re-export. The existing JSONB comparison stays in the canonical Node-only data
  codec. An exact-file utility allowance and new negative boundary tests keep it
  out of every other data file and the API. No provider import is allowed in core
  or browser code. Generic-arrow commas also remove the audit parser's JSX ambiguity.

## Verification record

Exact commands, scope, failures, native measurements and hashes are recorded in
[VERIFICATION.json](VERIFICATION.json). The shared synthetic Git provider now
understands the existing read-only batch query and reports native blob sizes. Read
queries count once as blob provider attempts, not Git writes; every attempt remains
included in totals. This changes no production provider query or mutation contract.

The final broad regression passes **1,493/1,493 tests**, including package boundary
checks. All eight package/application and prototype typechecks pass, as do all
88 prototype tests, the 95-artifact kit and workflow token-scope audit. No build or
browser acceptance run is claimed for this server-side increment.

Authenticated native default and proposal-continuation save/reopen pass. The final
owned-history selection also passes all 37 SDK/lineage isolation cases and the
early/late records, keys, sources, expiry, revision and hold denials. Its historical
portion verifies 20 records and six SDK exchanges with 52 simulated attempts; that
portion is still not the installed records/history service or full application cost.

Actual synthetic source review falls from **210 to 75 attempts**, scope preparation
from **844 to 320**, new-distinct preview from **3,722 to 3,447**, and confirmation
from **7,637 to 7,087**. Other actions still exceed the 200-attempt ceiling.
Both unchanged delayed draft/source prefixes pass, retaining both sets of samples.
Each direction's source-review sample uses 75 attempts and is below five seconds;
those single samples do not establish source-review p95. The latest prefix follows
the drain fix and precedes mechanical history-root relocation; final native/broad
verification covers that relocation. The full multi-action C22 protocol is not run.

During development, the first broad-shaped check exposed an obsolete synchronous
shutdown expectation. The initial native run exposed a missing read-query handler
in the synthetic provider. Two new test failures were fixture mistakes (unborn HEAD
instead of the fixture's exact head, and a supposed changed digest equal to its old
value). The old HTTP review's per-file request assertion also needed to reflect
one batch for two exact documents. Failures and their corrections are retained;
none is silently discarded as an outlier or reported as a production result.

Review also identified a nested-drain ownership gap before completion: awaiting
only the graph's public timeout could release application admission while its
actual policy work remained pending. A dedicated four-call timeout regression
now covers the exact drain handle. Source loading was made lazy before acceptance
to retain the existing validate-draft-before-source-read order.

## Remaining work

This integrates current corpus reads, not the entire records/history graph. Current
and historical scope/development projections, authorized target discovery and the
remaining outer action controls still require shared-record integration. The full
C22 warm/cold/concurrent protocol across every action is not complete. A passing
prefix or single source-review latency sample is not p95 for the whole workflow.

Real records adoption, authorized model quality, runtime GitHub saving and actual
signed-in UI/accessibility acceptance remain separate. The API-key safety skill
kept this work synthetic: no credential access, model call, spending, live runtime
save, deployment, record adoption, profile activation or gate signature. User drafts,
signed artifacts, roadmap and outputs are preserved.

**Intent capture: 68% (17/25; eight remaining; +0 percentage points).**
