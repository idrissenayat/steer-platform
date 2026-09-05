# Intent

Expose a safe, testable HTTP boundary for server-side sign-in and local logout,
and route cookie-authenticated tool calls through the existing grant boundary.
Prevent cross-site requests, open redirects, code/token leaks and session replay.

Use synthetic signed tokens for this increment. Real local Keycloak human-code
verification and trusted runtime membership/configuration follow separately.
