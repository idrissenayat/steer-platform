# D1 records and architecture adoption

Policy decision accepted on 2026-09-10. Live persistence remains inactive until
the accepted amendment's implementation and activation conditions are verified.

Idriss Enayat answered **yes** to the exact question confirming his authority as
STEER's records and architecture owner and approving revision 1 of
`docs/architecture/DRAFT-RECORDS-AMENDMENT.md` at commit
`9442b2d212b2c47c436cbe527dd07707b3c8174c`, SHA-256
`9191831b9870da5cb632d51e8f815aa538e7a191d4ac119f2d8318a264b53ac8`.
The [detached decision](../../operating/local-mac/records-d1-approval.json) retains
the question, literal response, task locator, exact bytes and limits. It records
a user confirmation, not a fabricated cryptographic signature or gate ruling.
Do not request this same policy decision again.

The approved proposal remains byte-identical, including its historical unsigned
header. This successor records the subsequent acceptance. The HR-01-R2 policy,
signed Architecture revision 2, Gate 1 artifacts and protected Exam remain intact.

## Authority and recovery successor to ADR 02 03 and 04

For an explicitly adopted organization and verified storage binding, Git remains
the canonical authority for business artifacts, declarations, decisions and
receipts. Postgres can separately retain encrypted private drafts and operational
records under D1. Those records are not rebuildable projections and must never be
truncated or reconstructed by a projection replay. An operational field cannot
approve, pull or release work or silently modify a canonical artifact.

| Store | Purpose | Recovery source |
| --- | --- | --- |
| Git | Published business artifacts and decisions | Authoritative versioned chain |
| Postgres projections | Board, inbox and search views | Replay from authorized source artifacts |
| Governed Postgres operational records | Private drafts, generation checkpoints, operation ownership and model accounting | Independent encrypted recovery plus current key and reservation reconciliation; never projection replay |

This changes authority and recovery semantics, not the chosen Next, Hono, Temporal,
Postgres, GitHub App, Keycloak or model-provider seams. The existing component
diagram remains the selected stack; this table supplies its amended data-boundary
view. The amendment does not grant a tool, activate a database migration, authorize
an application GitHub write, permit deletion, sign a gate or authorize deployment.
The independently approved live-model cap stays $5 total across all runs.

## Incorporation and activation sequence

1. Preserve the exact decision and approved bytes; project the accepted schedule
   into `kit/policy/intent-records.json` and the root doctrine/Learn sources.
2. Incorporate affected independent Exam requirements through the Exam owner and
   bind applicable gate rulings without editing historical signed artifacts.
3. Verify the exact local storage/schema/runtime binding and existing access,
   expiry/hold, all-copy/key lifecycle and accounting/recovery controls. Record
   measured recovery point/time and residual loss limits. No test grants are
   treated as real authority, and no deletion is performed.
4. Connect the existing draft, scope and development services to the actual
   authenticated application. Enable only the verified binding; preserve current
   owner/tenant/product checks and the shared durable $5 budget before model calls.

The read-only `local-workspace.mjs records-status` command checks the detached
local policy decision and its exact source digest without reading credentials,
opening a database or calling a model/provider. It deliberately returns no runtime
authority. Acceptance of this decision is not a W01–W08 workflow completion.

## Verification of this incorporation — 2026-09-10

- All 18 focused records-decision, local configuration/migration-boundary and Learn
  tests pass. Changed approval scope, source bytes, roles, confirmation or retention
  are rejected; the diagnostic cannot remove the real migration boundary.
- Kit validation, workflow token-scope audit and whitespace/diff checks pass.
  The actual web production build, including TypeScript and generated Learn, passes.
- The changed root Word documents were rendered with the bundled document runtime:
  Methodology 3 pages, Framework 6, Operating Model 8. Every page was visually
  inspected for readable text, intact diagrams/tables and no clipping or overlap.
  Existing signed sources and the exact approved D1 bytes remain unchanged.
- After stopping only the owned gateway/renderer before rebuilding, the same
  authenticated application was restarted with unchanged credentials and profile.
  Chrome sign-in through the existing identity session reopened the workspace;
  Learn showed the new Methodology section and the full Operating Model D1 section,
  including the exact accepted revision, schedule and activation conditions.

These are source/build checks, not evidence that persistent drafts or model calls
are available. No real database migration, model call, application GitHub write,
deletion, grant change or additional spending was performed for this incorporation.
