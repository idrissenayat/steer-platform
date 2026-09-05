# Development acceptance

Builder checks only, not an independent protected Exam or gate approval.

- [x] Shared selector/agent/subject checks and actual job/resource drain.
- [x] Fixed worker reader scope, separate secret and nonadministrative SQL role.
- [x] API one-shot compatibility and worker runtime denials/closure.
- [x] Actual Git/Temporal/PostgreSQL two-artifact readback and duplicate-safe resume.
- [x] History replay, source repair and Git-committed revocation.
- [x] Final repository/lock checks and documentation verification.
- [ ] Process/fleet recovery, authenticated queue/start service, gate waits/cursors,
      OTel, production bindings/retention and formal gates.
