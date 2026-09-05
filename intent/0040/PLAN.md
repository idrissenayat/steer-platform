# Implementation plan

1. Add the connection-owning scheduler wrapper with bounded actual operation drain.
2. Add explicit optional profile/factory pairing and exact binding in the API runtime.
3. Coordinate browser/MCP request drain before scheduler/identity resource cleanup.
4. Cover configuration, initialization, in-flight/failed stop and single-close cases.
5. Verify a separate actual Temporal connection plus full repository and browser
   regression, document exact limits, commit and verify the candidate push.
