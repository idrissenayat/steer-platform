# Development evidence — 2026-09-07

Base: `9b7e548`. Background continuation of the actual intent journey.

The existing scope-review component now collects an explicit proposed direction,
current target Brief where applicable and the person's exact explanation. Confirming
reruns `intent.overlap.check`, and the portable binder rejects changed source,
catalog, review, tenant, repository or target revision/digest. It never grants
clearance or claims persistence. Errors retain the explanation for a deliberate retry.

Synthetic component HTTP responses exercise real React controls and stale-review
handling. They are not an actual signed-in repository search. No new preview was
created. The Sites skill preserves the existing pink/orange Next surface and skips
browser handoff in this background run; hosting remains outside current authority.

## Verification

- Full web suite: 100/100 passed; full registry suite passed.
- Web/registry typechecks passed.
- Focused contracts/component/conversation/package-boundary rerun: 14/14 passed.
- Production Next build passed; restarted only the owned frontend/gateway services.
  Certificate-verified HTTPS request to `https://localhost:8443/` returned 200.
- Kit check passed (95 required artifacts), security check passed and whitespace
  check passed. Service availability is not signed-in browser acceptance.
- Portable tests cover all directions, exact reason preservation, changed source,
  catalog/review/tenant/repository, absent/wrong target, Spec-vs-Brief digest, invalid
  choices and attempted authority fields.
- Actual component test covers no default choice, reason requirement, current-target
  choice, fresh read on confirmation, changed explanation, changed fingerprint,
  retained explanation, explicit retry and source-input invalidation.

## Honest remaining boundary

This is a checked in-memory proposal, not a saved decision. Drafting and saving do
not consume it yet, as the UI explicitly states. Actual workspace read-model/grant
configuration remains missing, semantic duplicate review remains pending and the
model budget remains unapproved. No live models, runtime GitHub writes, grants,
signed artifacts, credentials or user drafts were changed. I1–I6 remain open.
