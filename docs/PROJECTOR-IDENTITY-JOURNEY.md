# Separate current projector identity in the local journey

Increment 0179 removes the manufactured worker principal from the durable
browser-created Brief journey. The owned Keycloak realm has distinct human,
dispatcher and projector subjects; the two service accounts have different clients
and generated secrets. Actual provider tokens and JWKS verification establish
identity, while the existing Git authorization resolver supplies current grants.

The projector client is explicitly allowlisted only for its authenticator. The
worker receives that authenticator through its existing composition seam, preserving
current checks around receipt readback, source verification and PostgreSQL ingestion.
Neither human saving nor dispatcher start/status permissions imply `projection.ingest`.
Grant updates retain all three membership records instead of overwriting another
identity's authority. A new current grant never changes the saved artifact revision.

## Observable checks

Before receipt access or a worker database connection, the test rejects a projector
with only dispatch permission, revoked membership, an invalid token, or the actual
dispatcher's otherwise valid token. After restoring projector authority, the queued
worker is reconstructed and the same exact operation projects once. Post-completion
projector revocation denies a direct re-observation without another receipt read.
The database event count, exact browser source read, replay and private-history
checks remain in the same journey. See `intent/0179/EVIDENCE.md` for actual results.

## Not established by this integration

This is generated local identity evidence, not approved production membership or
full governed saving. The create fixture still supplies synthetic gate authority;
provider response adapters operate native disposable Git. Auxiliary non-durable
fixtures and privileged test database assertions are not relabeled as real principals.
No live grant, automatic source admission, deployment or spending is enabled.
All five R5 findings and independent/qualified review/human gates remain open.

The next integrated boundary is current revocation across the asynchronous receipt
read itself, followed by explicit failed-workflow status/recovery behavior. Existing
early denial and successful replay must not be described as proof of those races.
