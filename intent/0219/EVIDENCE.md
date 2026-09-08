# Development evidence — 2026-09-08

Base: `f6792a8d580162e43ddcc3b0451fa2f9bb5f9b2f`.

## Delivered boundary

The immutable encrypted operation-input adapter binds original execution config
(including unchanged expiry/budget), exact source snapshot, evidence and omissions,
declared direction and both instruction profiles. Capture reads the actual admitted
SQL operation and decrypts/compares the actual source revision.

A fresh reader needs scoped records configuration, not the original execution
configuration in memory. It restores that configuration from ciphertext and can
compose it with the separate historical-result reader. Current records, evidence,
draft and key grants remain mandatory. No reading creates or renews a job/budget.

## Verification

- **141/141** disposable PostgreSQL/native-Git/Temporal integration checks passed.
  New checks cover exact private recovery, competing captures, input conflicts,
  lost acknowledgement, expired-config-to-result-history composition, later edits,
  owner/source/key/draft permission loss, holds, strict SQL grants/metadata,
  ciphertext corruption and close during key I/O.
- **290/290** scoped units and local migration controls passed:
  domain 27 + registry 170 + data 44 + worker 47 + controls 2.
- **1/1** destination runtime integration passed. Its disposable migration-count
  assertion initially expected 17 and was updated to 19; no runtime provisioning
  or real baseline was changed to obtain that result.
- **33/33** existing Temporal/projection integration checks passed with actual
  disposable services and reconstructed workers; identities remain synthetic.
- Full prototype/eight-package typecheck, required kit (95 artifacts), workflow
  token-scope audit and whitespace checks passed. Drizzle generation reported no
  schema drift after the two development migrations.
- Protected Architecture/Exam/accepted policy SHA-256 values match their prior
  exact bindings: `9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65`,
  `84ad1d4c14d6614fe4b53509104e379e9ad6dff0462c96109901eefb1e02fd7f`, and
  `f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32`.

## Non-claims

Not installed in the actual API/editor/Temporal runtime. D1 is unsigned/inactive.
Tests use real disposable SQL/encryption/source/result stores, but synthetic
authority, profiles, keys and role outputs. No live model/provider call occurred.
Constructor reconstruction is not demonstrated backup/all-copy recovery.

These are original submitted context and instruction profiles, not observed
rendered wire requests, provider delivery/usage, model authorship, semantic adequacy
or independent Test Agent execution. The eventual Test Agent request depends on
the actual Architect predecessor and still needs explicit capture/readback and
durable activity composition. No execution path consumes restored data automatically.
The composition test still uses a synthetic step-input digest and role output;
it demonstrates configuration/result recovery, not exact request-to-provider binding.
An older Exam retained in the source snapshot must be excluded from a future fresh
Test Agent context by the explicit role renderer.

Incomplete evidence stays incomplete. An input hash is not source access, human
direction evidence or proof of price/token bounds. Trusted ports supply those
checks separately. The current-source port must reauthorize every retained evidence
source before release, even when the stored snapshot remains structurally valid.

No signed source, canonical Exam, accepted policy, real migration/role/key, runtime
GitHub write, deployment, deletion or spending changed. User-owned roadmap/outputs
remain untouched and excluded. The nineteen-entry journal remains held against
the seven-entry real baseline.
