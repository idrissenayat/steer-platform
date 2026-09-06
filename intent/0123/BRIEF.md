# Brief: Exact confirmation and closed save orchestration

## Problem

A rendered preview and its fingerprint are not a Git commit, a gate signature or
permission to write. The first usable journey needs an exact human-confirmation
contract, current authorization and safe handling of duplicate/uncertain requests.

## Proposed outcome

Implement the shared create-only save/readback boundary. It regenerates the exact
confirmed Brief, binds actor/target/base/key/content, verifies current adapter
authority, dispatches at most once and reports only verified commit metadata or
explicit uncertainty. It remains unavailable without a trusted writer.

## Boundaries

No real provider call, runtime write binding, UI save control, gate approval,
deployment or spending. Synthetic writer tests are not code-host durability or
independent verification. All five R5 findings and remaining Phase 1 work stay open.
