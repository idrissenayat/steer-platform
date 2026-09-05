# Implementation plan

1. Inspect installed Next.js client-boundary guidance and current consumer/auth
   contracts. Confirm 0048 is published and preserve existing signed artifacts.
2. Implement fixed-origin bounded read transport and a small client panel inside
   the verified-session page. Keep the rest of the page server-rendered.
3. Add native tests and actual compiled-browser verification with synthetic
   Keycloak/Git/PostgreSQL. Inspect desktop/mobile screenshot output.
4. Run root verification and frozen install; document exact evidence, update
   delivery overview, publish the candidate branch and verify remote equality.

Next: typed operating artifact models/read tools and production intent backlog,
detail, board and inbox parity. Canonical gate proof, services and formal release
requirements remain separately tracked; no repeated broad Critic loop is added.
