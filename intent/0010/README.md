# 0010 · Revision-bound GitHub reads and current authorization

Parent: M2/M3. Authorized development increment, not Gate 2, live provider
access or write authority. Artifacts: Brief, Spec, Plan, development Acceptance
and Evidence. Protected independent Exam and formal gates remain pending.

This slice implements read-only code-host and authorization-source adapters.
Tests use generated signing keys and isolated provider responses. It does not
load the Test Agent App key or repurpose that identity as the runtime service.
