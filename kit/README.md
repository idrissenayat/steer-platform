# STEER adoption kit

This directory is the platform-independent Phase 0 kit. A team can copy it
into any repository and run STEER without the platform.

## Start here

1. Copy `templates/` into the repository's intent home.
2. Assign the four human accountabilities in `policy/gates.json`.
3. Install `hooks/pre-commit` and protect the default branch.
4. Run `node scripts/validate-kit.mjs` in CI.
5. Record the first pilot item's baseline using `metrics/definitions.json`.
6. Use `policy/sizing.json` and `practices/sizing-and-scoping.md` before Gate 1
   and again when an Engineer plan raises a sprawl alarm.
7. Use `policy/intent.json` and `practices/providing-intent.md` for every
   originator intake, rendered draft, and repeated-correction context update.
8. Use `policy/surfaces.json` and `practices/three-surfaces.md` to preserve the
   intent/work-item pull boundary and the inbox-first attention order.

The platform reads these files; it does not replace them. Git remains the
authoritative record for artifacts, signatures, gate notes, and learning
decisions.
