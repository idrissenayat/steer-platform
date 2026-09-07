# Specification

1. Strict optional recordedScheduling accepts itemId/UUID-v4 only. Require a separate
   callable factory; reject incomplete pairs before allocation.
2. Match returned target to Git organization/repository and profile item/operation;
   validate exact workflow ID and lifecycle/tool methods. Close resources on failure.
3. Pass the structural service through existing OIDC/current-Git authorization.
   No Temporal import in API, permission grant or dispatch at startup.
4. Drain requests before recorded scheduler/session cleanup, including without MCP.
   Attempt other cleanup after failure, sanitize errors, refuse calls and never reopen.
5. Verify signed-token/native-Git revocation and actual API-to-Temporal ownership,
   preserving synthetic provider/activity limitations and no live activation.
