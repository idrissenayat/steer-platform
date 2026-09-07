# Development acceptance

- Read-only provider calls return exact repository-scoped commit and parent identities.
- Native merge history, repeated targets and source-head links are preserved.
- One commit budget applies across all selected links with no excess read.
- Invalid configuration and missing capability fail before I/O.
- Unrelated, malformed, foreign, cyclic or exhausted graph evidence fails closed.
- Final source-head and observer-grant changes discard the assembled result.
- Selected paths cannot turn a historical HOLD into a PASS or grant write authority.
- Focused, type and full checks pass with provider/selection limitations explicit.
