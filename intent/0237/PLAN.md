# Plan

1. Add provider-free verification of exact scope request observations.
2. Add immutable encrypted request/response storage with current original, source,
   fence, reservation and records binding; enforce insert-time batch state in SQL.
3. Compose actual SDK hooks and PostgreSQL with synthetic transport/authority. Test
   lost acknowledgements, restart, quarantine races, immutable replay, tampering,
   current revocation, role isolation, expiry and close during pending verification.
4. Run compatibility, type, build, migration and governance checks. Record actual
   evidence and unchanged protected hashes; commit/push only owned changes.
5. Triage the intermittent legacy Temporal clarification outcome captured in the
   evidence, without relaxing assertions, deadlines or retry controls. Then continue
   verified successful scope checkpoints and reference-only Temporal,
   real authority binding, semantic evaluations and actual UI/save acceptance.
