# Spec

- In the actual-Keycloak browser journey, authorize the separate projector, complete
  an actual current human receipt read, then commit projector revocation before the
  worker receives that receipt. Its existing post-read authorization must deny before
  the first worker PostgreSQL connection.
- Restore current authority explicitly in the test and start the exact original
  operation through the separately authorized dispatcher. Recreate the queued worker;
  require one actual projection and unchanged saved content/revision. Two receipt
  reads are expected: one denied direct activity and one successful workflow activity.
- Retain early denial, post-completion revocation, replay, privacy and exact browser
  source assertions. The pre-dispatch denied activity is not a failed Temporal run.
- Separately dispatch a fixed operation through the owned identity runtime into an
  actual Temporal worker whose test activity fails once. Authenticated status reports
  FAILED with only workflow metadata. Revoked status access denies.
- After runtime/connection reconstruction, the same operation remains FAILED and
  start is rejected as duplicate. No second activity attempt, Git mutation, private
  failure disclosure, reset, cancellation or new saving operation occurs.

The terminal-failure scenario uses synthetic provider/activity failure inputs and
does not perform SQL. The actual browser revocation scenario supplies separate real
local identity/receipt evidence. Neither creates controlled retry functionality.
