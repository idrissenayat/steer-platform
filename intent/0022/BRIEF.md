# Intent

Bound database resources behind the API admission boundary. A slow statement,
contended lock or abandoned transaction must be stopped by PostgreSQL, not just
hidden behind a rejected JavaScript promise. Preserve tenant/namespace isolation,
atomic authentication operations and confirmed-commit reporting.

Use only disposable local data and generated credentials. Do not configure real
database access, deploy infrastructure or alter any approval/signature.
