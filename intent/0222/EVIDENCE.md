# Development evidence — 2026-09-08

Base: `a0201f0c91885145c5d67aa775602a0346af5ae8`.

## Implemented

`@steer/data/development-observations` stores separately immutable request/response
records with authenticated encryption, source/step ownership and current readback
checks. Requests preserve supplied transport body and exact reconstructed role
packet; responses preserve supplied body, nullable usage, provider reference and
validated role output. Responses must reference the stored request. Captured bytes
do not overwrite newer human revisions or confer execution/retry authority.

The new runner integration constructs fresh observation readers for verification.
Both roles complete and recover via actual encrypted SQL rows without an in-memory
provider map or additional synthetic cost reservations. This replaces the map only
in this new integrated test chain; the 0221 fixture remains a regression test.

## Verification

- **302/302** scoped units and migration controls passed: domain 27 + registry 170
  + data 53 + worker 50 + controls 2.
- Final disposable integration: **164/164** passed against PostgreSQL 16.14. Nine
  new groups cover exact encrypted body/usage recovery, strict step/input/owner and
  request-to-response binding, RLS/privileges, holds/revocation/corruption, lost
  request/response commit acknowledgements, quarantine, both runner roles with
  actual SQL verification, later human corrections and concurrent stage writers.
  Completed roles reuse four actual observation rows and the same 3+2 synthetic
  reservation total. The harness removed only its own container/temporary data.
- **1/1** actual destination runtime regression passed with the new disposable
  migration count. Its identity/transport/native-Git fixtures are not live UI QA.
- Full prototype/eight-package typecheck, kit (95 artifacts), token-scope audit and
  schema-drift generation check passed; no further schema change was generated.
- The new package export resolves from the worker workspace without constructing
  services or starting I/O.
- Final `git diff --check` passed. Protected Architecture/Exam/accepted policy
  SHA-256 values remain `9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65`,
  `84ad1d4c14d6614fe4b53509104e379e9ad6dff0462c96109901eefb1e02fd7f`, and
  `f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32`.

## Limits and unchanged authority

The store preserves trusted caller-supplied transport observations. Actual provider
request serialization, response parsing, usage extraction and their correspondence
to the rendered packet/output are not bound yet. Synthetic adapter labels and
stored hashes cannot prove provider delivery, pricing bounds or independent agency.
No actual model SDK/provider call was made. The API-key safety workflow preserved
the resolved key decision and the existing unapproved live-spend boundary.

Migrations 0019/0020 extend only the disposable development journal to twenty-one;
the real seven-entry migration guard still rejects it. No new roles/keys/grants,
real database changes, D1 adoption, signed Architecture/Exam/policy changes, runtime
GitHub writes, deployment or deletion. User-owned roadmap/output paths stay excluded.

This is not the live UI journey. Transport-bound recording, durable role activities,
real records authority, editor/API acknowledgement/recovery and I1–I6 acceptance
remain open. Unknown/expired observation investigation is not implemented and does
not automatically renew a job or permit a paid retry.
