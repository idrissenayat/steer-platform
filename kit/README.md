# STEER adoption kit

This directory is the platform-independent Phase 0 kit. A team can copy it
into any repository and run STEER without the platform.

## Start here

1. Copy `templates/` into the repository's intent home.
2. Assign the four human accountabilities in `policy/gates.json`.
3. Install `hooks/pre-commit` and protect the default branch.
4. Run `node scripts/validate-kit.mjs` in CI.
5. Emit content-free pilot events through `metrics/events.schema.json`, use
   `metrics/definitions.json` for metric semantics, and record approved-window
   results in `metrics/baselines.json` without substituting fixture figures.
6. Use `policy/sizing.json` and `practices/sizing-and-scoping.md` before Gate 1
   and again when an Engineer plan raises a sprawl alarm.
7. Use `policy/intent.json` and `practices/providing-intent.md` for every
   originator intake, rendered draft, and repeated-correction context update.
8. Use `policy/surfaces.json` and `practices/three-surfaces.md` to preserve the
   intent/work-item pull boundary and the inbox-first attention order.
9. Load `learn-manifest.json` for human Learn pages and role-scoped agent
   context. `version.json` must match its framework version or CI fails.

The platform reads these files; it does not replace them. Git remains the
authoritative record for artifacts, signatures, gate notes, and learning
decisions.
