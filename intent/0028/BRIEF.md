# Intent

Make the native sign-in stack runnable through one explicit local runtime entry,
with bounded TLS/HTTP handling and truthful resource shutdown. Replace the
application's test-only HTTPS transport in browser verification. Preserve closed
default startup and do not load or activate real user/provider credentials.

