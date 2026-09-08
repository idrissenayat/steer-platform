# Spec

- A versioned deterministic private renderer consumes the exact original envelope,
  operation ID, role and (for Test Agent only) Architect result/checkpoint pair.
  No caller history, authority flags or arbitrary tools are accepted.
- Preserve verbatim human intent, clarification turns, original source-revision
  Brief/Spec, declared direction, included evidence and coverage uncertainty.
  Whitelist source fields; never spread a document snapshot containing old Exams.
- Test Agent receives source-revision Brief/Spec as `originalDocuments`, separately
  from the succeeded Architect's candidate `brief`/`spec`. Removing the originals
  would lose constraints supplied through human edits. Exclude old Exam, Architect
  message/questions and private conversation state; this is not semantic redaction
  of similar text a user intentionally supplies inside otherwise permitted source.
- Require a non-clarifying Architect result with both documents, correct role,
  operation/source/owner/config/policy and exact rendered Architect input digest.
  Domain-separate the request digest and include predecessor reference/digest,
  instructions/profile/runtime revisions, route, output limit and output contract.
- The uninstalled reader loads/decrypts actual originals and result checkpoints,
  requires succeeded Architect state and current unchanged draft revision, and
  compares own claimed-step input/predecessor against the prepared request.
  Missing/mismatched Architect predecessors deny Test Agent preparation. Own steps
  may be absent or correctly claimed; sent, known-failed, quarantined or completed
  own work cannot be presented as new work. Reread state after source restoration.
- Recheck current request, source/evidence, draft, result, key and lifecycle access.
  Expired operations, holds, later edits and late revocation/close deny release.
  Bounded reads retain admission while timed-out dependencies drain.
- Only private workers may receive request text. Workflow history/status/URLs/logs
  may carry references, never this packet. The packet's binding metadata is not
  part of the model prompt; a future adapter sends only the role-approved context.
- Always return execution/retry/gate authority false. Durable claim and acknowledged
  dispatch, current budget/source authority, independent execution and provider
  receipt/usage evidence remain separate prerequisites.

This is deterministic preparation/readback, not persisted or observed wire-request
capture. Pin renderer semantics to the approved runtime/profile before activation;
version changes must not silently rerender an already admitted paid attempt.
