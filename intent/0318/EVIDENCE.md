# 0318 — Joint current-scope/original validation evidence

Date: 2026-09-10. Base: `3f4986887da1ececf984b97d4de8ca777f80d897`.
Contract: [Spec](SPEC.md). Exact checks and samples: [verification](VERIFICATION.json).

## Delivered behavior

The API's explicit owned original-read hook now supplies one private current-scope
port to the data service. The data service still canonically verifies each original
and binds its exact source, direction and recorded assessment on every consumption.
It does not trust the hook to replace current scope with history or no assessment.

The owned current-scope window encloses original reads, start authorization,
operation inspection and full final development records/key comparison. Its full
final scope read occurs afterward and must exactly match the initial current
assessment. During that final scope IO and return, development record/key purposes
and original/source/draft/operation authority are freshly checked. No final records,
key or current-scope check is omitted. Scheduling remains outside each phase;
scheduler-requested and post-effect validation start fresh phases.

The scope window no longer runs duplicate source/caller permission queries with
no intervening IO for the same immutable intermediate consumption. Each such read
still performs one fresh source/caller barrier before synchronous return. Actual
initial/final reads retain their complete IO brackets. This is not permission
caching, cross-request reuse or permission to execute a side effect.

One package subpath exposes the existing internal scope-window helper only to the
permitted API composition layer; no HTTP/tool schema or browser flag is added.
Ordinary fallback admission/policy ordering is preserved.

## Measured effect and limits

| Synthetic authenticated action | 0317 | Reordering only | Final 0318 |
| --- | ---: | ---: | ---: |
| Drafting start | 989 | 996 | 938 |
| Drafting recovery | 1,127 | 1,135 | 1,069 |
| Drafting repeat | 1,127 | 1,135 | 1,069 |

Full scope reads fall nine→six across three validation phases; physical development
key reads remain six in the focused complete-scope fixture. All requests still
count, including identity/token attempts. The net improvement is 51 (5.16%) for
first start and 58 (5.15%) for recovery/repeat, not the apparent 33% reduction in
full scope reads. The reordering-only measurement is retained as an unsuccessful
performance iteration rather than hidden.

Other measured actions are unchanged: scope preparation 292, scope start/recovery/
repeat 195/221/221, drafting preparation 532/487, save review 211, new-distinct
preview/confirmation 330/853 and continuation 440/1,073. Undelayed functional
samples on a shared host are not p95, the complete C22 protocol or real-provider
performance. C22's 200-attempt limit and 20 ms delay per attempt are unchanged.

## Verification scope

Focused owner/current-scope/current-authority/factory/boundary tests verify exact
single intermediate grants, full IO brackets and fresh denial before reused content
returns. Native ordinary/owned start checks retain equivalent receipts, negative
current/history/profile/grant/source cases and actual key drainage.

Both final synthetic authenticated journeys use the final production and test
source. The complete-scope helper covers one success and ten cross-boundary change
cases; three malformed private scope bindings are rejected by the data owner.
An additional held-final-scope case proves that development shutdown cannot finish
until that actual scope work drains, even after development keys were reread.
New/continued native Git saves, restart/lost acknowledgement, fixed dispatch,
read-only receipt recovery and exact reopen remain synthetic authority/model
verification, not a runtime GitHub save or signed-in UI demonstration.

Final focused tests pass 56/56 and broad regressions pass 1,534/1,534, with no
failures or skips. Final types, kit (95 artifacts) and workflow-scope audit pass.
Native start passes nine checks plus migrations; final new-distinct/continuation
selections pass three/one joined checks plus migrations. Exact results are recorded
in the verification file. Earlier joined runs predated the additional adversarial
cases and no-IO change and are only intermediate results. Final reruns supersede
them. No full PostgreSQL suite, build or browser result is claimed.

No model use/spend, runtime GitHub artifact save, records/profile adoption,
deployment, release or signature occurred. Only harness-owned disposable database
containers/tmpfs data were cleaned up. Protected architecture, Exam, retention
policy and 0289 diagnostic evidence retain their hashes. User roadmap and outputs
are untouched. Passing recovery does not explain the retained 0289 uncertainty.

**Intent capture: 68% (17/25; eight remaining; +0 percentage points).**
Next consolidate repeated current-caller/metadata traversal in preparation, start
and confirmation. The unchanged complete benchmark, governed live activation,
real-model quality and actual signed-in UI/save acceptance remain required.
