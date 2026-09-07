# Plan

1. Inspect existing composition, authority and owned host resources.
2. Add explicit provisioning/runner and configuration regression tests.
3. Provision persistent TLS database, canonical migrations and actual Keycloak user.
4. Bind the actual subject to narrow non-secret membership through ordinary Git;
   verify the runtime App can read it without granting write permission.
5. Check TLS, isolation, persistence, real discovery and login form. Document
   required browser trust/password actions and unchanged live-write restrictions.
6. After user-assisted first login, separately verify the actual authenticated UI.
   This final personal-account acceptance is not automated or claimed in advance.
