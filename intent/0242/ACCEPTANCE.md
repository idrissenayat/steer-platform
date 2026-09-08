# Acceptance boundary

- Every synthetic provider request is preceded by actual SQL dispatch ownership and
  a newly acknowledged encrypted request record. Completed recovery reads the same
  checkpoint; no duplicate call or reservation is created.
- Foreign/unknown/expired/stale scope, permission loss, lifecycle holds, invalid
  provider output and ambiguous acknowledgements do not become success, no-match
  findings or retry authority. Human edits survive, including in-flight corrections.
- Underlying late dependencies retain admission after cancellation; late responses
  cannot produce a new dispatch, stored success or private result release.
- Evidence states which services are real disposable implementations and which
  inputs/permissions/responses are synthetic. Full and focused suites are distinct.

This is development verification, not Gate 2, qualified semantic assessment,
regulated records adoption, a live signed-in journey or runtime Git save/reopen.
D1 remains unsigned/inactive and the first-test model budget remains unapproved.
No change to protected signed sources, real keys, grants, deployment or release.
