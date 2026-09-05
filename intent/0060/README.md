# 0060 · Shared protected-action successor candidate

One offline deny-by-default verifier covers the existing Exam-candidate commit
and the six lifecycle/migration actions omitted from the frozen R5 manifest.
Every action uses the same actor, one-use credential, delegation, assignment,
authority, exact resource, replay and CAS checks with explicit signature times.

Read BRIEF, SPEC, PLAN, development ACCEPTANCE and EVIDENCE. The executable
manifest is the canonical `manifestBytes` export in protected-actions.candidate.mjs;
its digest is required by independently installed trusted contexts.

This is Builder-authored candidate evidence, not an independent Exam or gate.
No production route, credential acquisition, database migration, provider request,
deletion or protected Exam edit is enabled. Full graph composition is next.
