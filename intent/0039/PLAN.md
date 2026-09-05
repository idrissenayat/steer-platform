# Implementation plan

1. Add strict provider-free command/query contracts and fresh authorization.
2. Add a fixed-routing Temporal client adapter with typed error classification.
3. Verify denied/uncertain/duplicate paths and HTTP/MCP parity in native tests.
4. Exercise canonical dispatch against the actual isolated Temporal server and
   rerun existing Git/PostgreSQL and separate-process recovery checks.
5. Run repository checks, record exact evidence/limits, document composition,
   and publish the verified candidate without modifying protected/signed records.
