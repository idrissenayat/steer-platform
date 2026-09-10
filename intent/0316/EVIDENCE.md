# 0316 — Owned current-original scope-start evidence

Date: 2026-09-10. Base: `1891ffb7ec2f243f4b6b2e6cb8a7c8a05781347e`.
Contract: [Spec](SPEC.md). Exact checks/samples/hashes: [verification](VERIFICATION.json).

## Delivered

The authenticated factory now supplies its explicit current records/key binding
to scope start. The original-only selection retrieves the exact draft, latest
revision, retained original, immutable run manifest, budget and terms. It excludes
changing observations, batches, reservations and unrelated records, including from
key requests. Expired originals deny before ciphertext retrieval. Existing current
and historical scope-review behavior remains separate.

Initial binding and first authorization share one read-only phase. Each sequential
use checks present source/draft/original/review permissions. Canonical original,
manifest, profile, configuration, exact source and false authority flags must match.
Final complete records and keys are re-read after dependent work. Scheduling occurs
only after phase closure; scheduler-requested and post-effect validation open fresh
phases. No permission/result cache or validation carried across effects is added.

The fallback reader remains for an absent binding; invalid explicit bindings never
fall back. Replaced methods, malformed/skipped/escaped/parallel work, late changes
and closure deny. Actual pending key/records work remains owned through shutdown.
Public tools, deadlines, execution approval, tenant boundaries and source fidelity
are unchanged. Six physical key-provider reads cover three phases in the focused
native scheduler fixture; this is not a six-request whole-action claim.

## Measured effect

| Synthetic authenticated action | 0315 attempts | 0316 attempts |
| --- | ---: | ---: |
| Scope start | 406 | 195 |
| Scope start recovery / repeat | 460 / 460 | 221 / 221 |
| Drafting start / recovery / repeat | 1,407 / 1,594 / 1,594 | 1,407 / 1,594 / 1,594 |

First scope start removes 211 attempts (51.97%). Recovery/repeat remove 239
(51.96%) but remain above 200. Scope preparation stays 292, drafting preparation
532 / 487, save review 211, new-distinct preview/confirmation 330 / 853 and
continuation 440 / 1,073. These still exceed 200. Counts include identity and token
calls. Undelayed functional samples on a shared host are not p95, live-provider
performance, the full C22 protocol or actual UI acceptance.

## Verification

Final focused checks pass 65/65; broad package/application regression passes
1,529/1,529. Prototype/eight-package types, the 95-artifact kit check and workflow
token-scope audit pass. Native scope start passes ten checks plus migrations,
including legacy/owned receipt equality, unchanged records, late hold/edit/key/
record/source/method denial, post-scheduling revocation without redispatch and
shutdown drainage. Native current/history scope reads pass 21 checks plus migrations.
The strict `--scope-start` selector is explicit about its limited coverage; default,
full-suite and performance routing are unchanged. These are not full SQL-suite,
build, browser or live-acceptance claims.

Both final authenticated synthetic journey directions are recorded separately in
the verification file. Authority/model exchanges and Git transports are synthetic;
native HTTP, Git object verification, PostgreSQL and Temporal exercise the actual
application composition, including restart, lost acknowledgement, recovery and
exact reopen. They do not establish real output quality or a live repository save.

The first typecheck found a missing start-schema import; the import was added and
final types pass. An intermediate version used a separate initial binding phase
and measured 212 / 238 / 238 start attempts. Its successful journey and focused
checks are retained as intermediate evidence, not substituted for final-source
verification after consolidating the adjacent initial read-only phases.

No live model use/spend, runtime GitHub artifact save, records/profile activation,
deployment, release or signature occurred. The harness cleans up only its own
synthetic containers/tmpfs data. Protected architecture, Exam, retention policy and
0289 performance evidence retain their hashes; the user roadmap and outputs are
untouched. Passing recovery does not resolve the retained 0289 observation.

**Intent capture: 68% (17/25; eight remaining; +0 percentage points).**
Next consolidate drafting-start current-original reads (still 1,407 / 1,594 / 1,594
attempts), then remaining preparation and confirmation controls. Preserve separate
effect phases and independent present authority. Complete the unchanged benchmark
before claiming C22; real model, governed activation and signed-in UI acceptance
remain separate requirements. No new completion estimate is asserted.
