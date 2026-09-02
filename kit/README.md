# STEER adoption kit

This directory is the platform-independent Phase 0 kit. A team can copy it
into any repository and run STEER without the platform.

## Start here

1. Create the operating repository from `templates/ORG.md`, then declare its
   portfolios, products, and pods from the matching templates.
2. Register tenant-scoped human and agent identities and assign explicit hats
   in `policy/organization.json`; solo mode may assign every hat to one human.
3. Select a product Stack Pack and run `readiness/checks.json`; draft each
   finding as an on-ramp brief in the product home repository.
4. Apply `policy/gates.json`, including the commercial or regulated
   minimum-distinct-signer rules, and protect the default branch.
5. Install `hooks/pre-commit` and run `node scripts/validate-kit.mjs` in CI.
6. Emit content-free pilot events through `metrics/events.schema.json`, use
   `metrics/definitions.json` for metric semantics, and record approved-window
   results in `metrics/baselines.json` without substituting fixture figures.
7. Use `policy/sizing.json` and `practices/sizing-and-scoping.md` before Gate 1
   and again when an Engineer plan raises a sprawl alarm.
8. Use `policy/intent.json` and `practices/providing-intent.md` for every
   originator intake, rendered draft, and repeated-correction context update.
9. Use `policy/surfaces.json` and `practices/three-surfaces.md` to preserve the
   intent/work-item pull boundary, person-level capacity, greenfield state, and
   inbox-first attention order.
10. Load `learn-manifest.json` for human Learn pages and role-scoped agent
   context. `version.json` must match its framework version or CI fails.

The platform reads these files; it does not replace them. Git remains the
authoritative record for artifacts, signatures, gate notes, and learning
decisions.
