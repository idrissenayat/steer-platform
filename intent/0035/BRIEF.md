# Brief

Agents need to reach the same scoped artifact tools as people through one
explicit runtime. A separate test endpoint is insufficient integration evidence.
Use the existing HTTPS gateway, OIDC/Git authorization and PostgreSQL services;
require explicit MCP client configuration and drain both transports before
closing resources they share.

Success is an official MCP client reading a real disposable PostgreSQL artifact
through the browser's production-source service/gateway/listener composition,
with revocation and tenant denial, while browser regression still passes.
No real provider credentials, spending, deployment or gated writes are in scope.
