# Brief

The browser-created Brief already reaches actual local Git, Temporal and PostgreSQL,
but the browser harness starts its workflow directly. Replace that start with the
owned identity runtime and an actual disposable Keycloak service-account token,
current Git dispatch grants and exact operation binding. Preserve the real human
browser/session/readback path and all existing denial/recovery checks.

No new provider access or live configuration is required. Gate and projector authority
remain explicitly synthetic until their governed production composition is complete.
