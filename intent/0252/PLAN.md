# Implementation plan

1. Define portable exact read input/output verification and service scope.
2. Compose existing bounded regular Git-blob reads with per-request identity
   revalidation; register the query once for HTTP/OpenAPI/MCP.
3. Add canonical metadata links and a saved-candidate view in the actual workspace.
4. Test native temporary Git plus HTTP/MCP parity, revocation, tampering, exact
   bytes, safe React rendering, preview clearing and current-draft preservation.
5. Run regression/type/build checks, update evidence, and push only owned source.

No live service activation, migration, credential inspection, model spending or
runtime Git saving. Continue save preparation/confirmation/status integration and
historical agent recovery under the current intent journey after this slice.
