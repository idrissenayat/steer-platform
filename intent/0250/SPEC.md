# Scope evaluation contract

1. Create a deterministic 23-case synthetic corpus covering the journey's semantic
   distinctions and coverage failures, including a 34-source cross-batch case.
   Labels/rationales remain explicitly candidate, not human-adjudicated.
2. Reuse production scope preparation and recorded SDK verification. Only supplied
   observations are replayed; no model runtime, transport, credential lookup or
   durable records adapter exists in the evaluation command.
3. Bind suite and each case to exact profile, inputs, production requests and
   candidate expectations. Reject stale, duplicate or unknown case/batch bindings.
4. Score exact relation, expected corpus completeness and decisive citation spans
   separately from raw exchange validity. Adjacent citation ranges may cover a
   decisive span. Missing cases and batches cannot improve the denominator.
5. Return stable content-free reports and failure codes. Hash the full parsed
   replay and report. Every report keeps semantic quality, live provider evidence,
   execution, saving and gate claims false; explanation review remains required.
6. Support manifest and bounded regular-file UTF-8 JSON replay only. Never print
   private source/model text or raw exception/path details. Exit 0 for manifest/all
   candidate checks passed, 1 for scored failures/missing cases, 2 for invalid input.
7. Existing CI discovers new tests through `@steer/agents test`; package typecheck
   includes evaluator files. No migration, dependency, provider, auth or deployment
   changes. No protected signed artifacts or user-owned files are edited.

Real semantic accuracy still requires adjudicated labels, representative held-out
examples, explanation review and authorized provider execution/evidence. A test
transport copying reference labels proves only harness behavior.
