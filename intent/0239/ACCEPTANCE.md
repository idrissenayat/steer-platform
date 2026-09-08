# Acceptance boundary

Actual encrypted SQL observations and the pinned SDK verifier must support a
successful batch checkpoint and exact restart readback with one model call and one
reservation. Replay must not rewrite success. Missing or altered evidence, wrong
owner/fence, absent/non-void verification and current authority loss must block it.

Lost checkpoint acknowledgement may recover already-committed success. A quarantine
or known failure winning during readback cannot be promoted or reset. Lifecycle
lock contention must fail safely without deadlock. Timed-out dependencies retain
bounded admission until they drain, and shutdown cannot checkpoint late work.

SQL must deny invented success without a matching response and keep observation
content inaccessible to the execution runtime. A successful metadata transition
is not a semantic verdict or clearance to create, update, sign or save an intent.

This is not the canonical Exam, independent Gate 2 acceptance, real records-policy
adoption, model-spending approval, live provider evidence or signed-in UI acceptance.
