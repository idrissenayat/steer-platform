# Brief

The destination panel, browser sign-in and durable runtime have separate coverage.
Verify their combined boundary: a real Keycloak-authenticated browser session must
work with the actual runtime and Git reader, without losing the user's unsaved
draft or implying permission to save.
