# Implementation plan

1. Add one-statement scoped reference snapshot/checkpoint reader.
2. Add the canonical snapshot schema/tool with fresh authorization and capacity
   refusal; compose under the existing explicit feed opt-in.
3. Verify real SQL atomicity while projection transactions are held/committed,
   empty scopes, history-gap resnapshot, RLS and overflow. Test boundary failures.
4. Verify real browser/MCP snapshot and cursor resume against Keycloak/Git/Postgres.
5. Run repository/frozen-install checks, document, publish and verify remote.

Next: consumer lifecycle and authenticated operating surfaces, with canonical
gate source/proof verification and remaining services still tracked separately.
