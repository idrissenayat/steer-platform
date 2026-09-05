# Brief

The API must distinguish a cryptographically verified identity from arbitrary
caller headers, then recheck current tenant membership and grants on every
operation. Build a provider-isolated OIDC binding usable by the shared API,
without connecting real providers or treating signed stale roles as authority.
