# Spec — Native domain-review source fidelity

## Native record interpretation

`normalizeGateDomainReview` reads bounded original JSON text using the existing
`steer-domain-review-record/v1` structure from `kit/schemas/domain-review-record.schema.json`.
It retains the complete parsed record and exact report digest. Pretty-printed source
bytes remain unchanged; only insignificant JSON whitespace may differ from compact
JSON.stringify representation. Duplicate keys, ambiguous alternate encodings, unknown
fields, unsupported versions, invalid UTF-8 and records above 64 KiB reject.

Bind organization, record-item, reviewed revision, selected Exam path/hash and domain
to explicit expected facts. Validate exact UTC chronology, unique reviewed cases and
finding IDs, known statuses/severities/triggers, escalation links and all four native
non-authorization boundaries. Open blocker/major findings require their canonical
escalation trigger; low confidence requires the inconclusive-evidence trigger.

The supported trigger vocabulary matches the existing kit policy. This is a supported
native profile, not permission for an unknown trigger or changed policy to be ignored.
Runtime resource limits additionally cap cases at 10,000, findings/escalations at 100,
individual evidence lists and the complete unique reference set at 128.

Normalize conservatively:

- `passed` requires approved decision, zero open findings and no pending escalations,
  consistent with the native consolidation's hold/send-back boundary.
- All open findings count, including minor/nit; resolved findings remain in the record.
- Medium confidence remains `medium` in the retained record and maps to `low` in the
  existing high/low policy input. It is never promoted to high confidence.
- Any pending escalation sets humanRequired. A signature cannot clear an unresolved
  native escalation merely by satisfying a specialist-hat requirement.
- A reviewer identical to the selected Builder cannot produce a fresh/independent
  normalized review. All declarations still require actual independent verification.

## Collector binding

A review reference may explicitly select format `steer-domain-review-record/v1` with
domain, examPath and a duplicate-free fixed evidence path/digest allowlist. This is
permitted only for Gate 2, and examPath must be an artifact already selected by the
actual canonical signer collector. Its actual original hash binds the native Exam.
The default compact normalized profile remains supported unchanged.

Read the native report at the current source revision. Its reviewedAt must not be
future or later than any canonical gate signature. Derive the complete reference
union from target.exam, top-level evidence and every finding's evidence. Equal
duplicate references may share one read; contradictory hashes for a path reject.

Compare the whole union to the fixed startup allowlist before reading any link.
Reports cannot choose new paths or omit finding-only evidence. Verify every pinned
artifact at the reviewed artifact revision using actual path/scope/revision, UTF-8,
SHA-256 and Git blob checks. Each linked artifact is limited to 512 KiB; all retained
policy/native source bytes across the chain are limited to 8 MiB. This does not
remove the existing signer collector's separate bounds.

The exception source is read before reviews so its selected Builder identity can
be used consistently. Its review digest links still point to the original native
report bytes. Retain all original-revision source snapshots and a native observation
with linkedEvidenceVerified true only after all exact references were read successfully.

All shared actor, current-head, deadline, signer-validity, timeout ownership and
shutdown checks remain. Output still requires governed selection, current source
and reviewer authenticity verification and is never gate or write authority.

## Remaining limits

The native record's identity/context/evidence declarations are not provider receipts.
Reading source bytes does not validate experimental results, substantive review
quality, professional competence or independent task assignment. Native Critic and
exception format integration, governed selection and authentic provider bindings
remain separate unfinished work. No canonical records are migrated or regenerated.
