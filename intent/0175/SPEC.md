# Specification

1. Shared registry definitions supply internal, HTTP/OpenAPI and MCP contracts for
   `workflow.recorded-brief.start` and `.status`, each with its own explicit grant.
2. Exact bounded organization/repository/item/UUID-v4 input must match the configured
   service and derived workflow ID. No routing, subject, receipt or authority fields.
3. Start accepts only current hat-free agents; status accepts current explicitly
   granted humans or hat-free agents. Revalidate subject/type/tenant/grant/expiry/time
   before I/O, and after status I/O. Check binding after asynchronous work.
4. Missing trusted service/revalidator denies. Saving, ingestion, hats and ordinary
   reconciliation grants cannot substitute. No default runtime or live grant is added.
5. Sanitize start failure/malformed output to unknown, preserving accepted effects
   after later revocation. Keep already-attempted distinct. Never retry automatically.
6. Status exposes validated minimal execution metadata only; revoke before disclosure.
   COMPLETED is not source/Git/projection success or gate approval.
7. Prove HTTP/MCP parity and actual local Temporal dispatch through the canonical
   boundary; retain synthetic dispatcher/receipt-provenance limitations explicitly.
