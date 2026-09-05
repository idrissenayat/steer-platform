# Specification

1. Add workflow.reconciliation.start (command) and workflow.reconciliation.status
   (query) to the canonical registry, schemas, OpenAPI and MCP discovery/dispatch.
   Each requires its exact explicit tool grant and a current same-org principal.
2. Start accepts exactly organizationId, repository, itemId, rounds and intervalMs;
   status accepts only the three scope fields. Enforce the existing worker scope
   grammar and absolute bounds, plus stricter runtime caps. Caller queue,
   namespace, identity and hat injection deny before scheduler access.
3. The optional scheduler fixes one scope/workflow ID, namespace and task queue.
   Missing composition/revalidation remains unavailable; no default activation.
   Snapshot validated configuration. Do not import Temporal into the registry.
4. Revalidate the same subject/type, current grant, tenant and expiry immediately
   before dispatch. Agents cannot carry human hats. Invalid/regressed clocks and
   failed refresh deny. Status refreshes again after I/O before releasing output.
5. Start returns only started with workflow/run IDs, duplicate, or unknown.
   Malformed/mismatched results and thrown failures become unknown with the fixed
   ID. No automatic tool retry or post-dispatch rollback claim. The installed
   client's typed duplicate error is distinguished from other failures.
6. Status returns found with ID/run/state, typed not-found, or unknown. Never
   expose provider error text or conflate unavailable service with absence.
   Retained closed IDs still reject duplicates; expiry of history is not permanent
   business idempotency. Absence does not establish that no prior run existed.
7. MCP declares start non-read-only and non-idempotent; queries remain read-only.
   Verify schema/result parity with the official client and HTTP, plus actual
   local Temporal start/status/duplicate behavior and existing recovery regression.

Non-goals: live cluster authentication/ACLs, API bootstrap scheduler ownership,
multi-item scheduler selection, webhook scheduling, continuous scheduling, gate
waits/cursors, live Git writes, model calls, production readiness or gate closure.
