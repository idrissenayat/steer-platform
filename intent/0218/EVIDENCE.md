# Development evidence — 2026-09-08

Base: `72676a93511d2e6ed94d80309a015266f2b082b6`.

## Delivered boundary

`createExpiredDevelopmentStepReader` is a separate metadata-only interface. It
checks the original configuration digest and DB expiry and exposes no execution
mutation. Current history authorization runs before/after a read-only transaction,
without holding a lease across the external check. The old budget is not read or
renewed; old execution authority is not reused for historical content access.

`development-results.readHistorical` is opt-in with separate current history
authority. It restores actual encrypted source/result bytes under the existing
lifecycle, scope and key controls. The response identifies the original and latest
draft versions, marks itself historical and omits the checkpoint reference. Normal
read/capture/checkpoint routes still reject expired execution configurations.
Draft-read authority is rechecked after result-key I/O as well, so revocation after
the earlier source restoration cannot be masked by an otherwise valid history grant.

## Verification

- Disposable PostgreSQL/native-Git/Temporal integration: **133/133** passed,
  including actual job expiry, inactive budget, read-only history metadata,
  quarantines, current history/draft revocation, holds and close during key I/O.
- Scoped domain/registry/data/worker units and local migration controls:
  **286/286** passed (27 + 170 + 40 + 47 + 2).
- Existing Temporal/projection integration: **33/33** passed with the actual
  disposable server and recreated workers; identities remain synthetic.
- Full workspace/prototype typecheck, required artifact kit (**95**), workflow
  scope audit and `git diff --check` passed.
- Protected Architecture, Exam and accepted retention-policy SHA-256 values remain
  `9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65`,
  `84ad1d4c14d6614fe4b53509104e379e9ad6dff0462c96109901eefb1e02fd7f`, and
  `f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32`.

The first integration rerun exposed an existing fixture comparing PostgreSQL's
discard timestamp against the host clock. Creation/discard assertions now bracket
the operation using PostgreSQL observations; synthetic publication proof uses that
clock too. The corrected full integration rerun passed. Runtime clock and policy
behavior was not weakened or changed.

## Non-claims

Clock-expiry tests actually let a short-lived disposable job expire; they do not
simulate several days of live operation or establish backup/retention acceptance.
Metadata, crypto, SQL and result recovery are real owned test components. Identity,
history authority, keys and role output remain synthetic. Historical access does
not establish model/provider provenance or independent Exam adequacy.

Tests retain the exact original configuration as a fixture. Availability of that
configuration after a real cold restart still depends on the authorized original-
input/configuration store; this increment does not create that missing service.

The reader is not installed in a browser/API runtime. D1 remains unsigned/inactive;
current production history/records authority, key/all-copy recovery, original role
prompt/evidence envelopes, provider provenance, durable development activities and
actual UI acceptance remain open. All historical reads remain limited by the
original draft lifecycle; there is no extension, purge or automatic retention job.

No schema/migration baseline, live key/grant/draft, paid call, runtime GitHub write,
deployment, deletion, signed architecture, protected Exam or accepted policy changed.
User-owned roadmap/output files remain untouched and excluded.
