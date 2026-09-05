# Specification

1. Strictly validate bounded normalized target, policy, record, signatures,
   prerequisite, Critic, build evidence, domain assurance and evaluation time.
   Unknown/missing/malformed fields return INVALID_INPUT without echoing data.
2. Record org/repository/item/gate/revision/digest must match the target. Only
   approved is policy-eligible; declined/send-back remain non-approvals. Agents
   cannot satisfy human seats. Required hats follow the current gate model.
3. Normalized decision positions are ordered, contiguous and unique; primary
   hats occupy their expected positions. Duplicate signer/hat pairs and unrelated
   hats deny. Specialist assertions follow primary seats and must cover every
   required domain. This is a normalized policy representation, not a migration
   of historical envelopes or a complete specialist-seat write protocol.
4. Timestamps cannot be future, reverse signature order, precede prerequisites,
   or be at/before the current exact-revision passing fresh-context Critic.
   Gate 2/3 require the immediately prior approved gate with same item scope.
5. Gate 3 requires current passing Exam and plan-conformance evidence. Commercial
   default-closed Gate 3 sessions must differ from EVERY Gate 2 signature session,
   including other humans and multiple sessions by one human (SIG-12/WS-12).
   Authentication must occur after the Critic and no later than signing; one
   session cannot assert different subjects or authentication times.
6. Regulated closed work requires at least two distinct contributing human
   subjects at each gate and specialists for every activated domain. User-facing
   Gate 3 requires accessibility specialist coverage. Additional configured or
   evidence-triggered specialist domains cannot be silently ignored.
7. Closed/open state must agree with the explicit activated-domain set. Closed
   work requires one current independent fresh-context high-confidence passing
   review per domain, no unresolved findings, distinct review digests, and a
   current exception brief linking exactly those digests. Self-review, missing,
   stale, duplicate, low-confidence or incomplete linked evidence blocks.
8. Return policy-satisfied or blocked with stable reasons and ALWAYS
   sourceVerificationRequired: true. No allow/approve/write/sign operation or
   public registry tool is added. Supplied facts still need independent source,
   provider proof, current authorization, qualification and policy verification.

Sources: intent/0001/SPEC.md (signer policy), read-only EXAM.md SIG-01–15 and
WS-12, and docs/decisions/0001-agent-first-domain-assurance.md. This increment
is not full satisfaction of those end-to-end cases and does not close Gate 2.
