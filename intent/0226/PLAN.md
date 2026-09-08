# Plan

1. Implement bounded portable draft transport and exact-response binding checks.
2. Implement a session-scoped preservation/recovery/conflict controller.
3. Integrate explicit controls and inert restore previews into the actual editor;
   invalidate provenance/reviews on restoration and preserve original bytes.
4. Exercise real production React components with synthetic HTTP responses,
   including typing during saves, lost acknowledgements, conflicts, restoration,
   scope changes, hiding and accessibility checks. Keep these distinct from real
   signed-in browser/database/model acceptance.
5. Run complete web regression, architecture boundaries, full typecheck, production
   build, kit/security/migration controls; document and push only owned changes.

This increment crosses client transport, state, React, display configuration and
their tests. Numbered evidence and project ledger/plan updates explain the scope;
no additional library, provider, database or architecture layer is introduced.

Next: current-authority recorded-development start/status/result API and editor
connection, owned-draft discovery/recovery after refresh, then the full source
review/semantic overlap integration. Real records, model and Git-saving activation
remain separate from implementation and require their existing approvals.
