# Authenticated artifact projection reads

The identity foundation can show who is signed in, but cannot yet return a
business artifact through the production tool boundary. Add one revision-pinned
read operation using the existing Git ingestion and tenant data foundations.

Success means a real isolated browser reads a synthetic Git artifact after
ingestion into PostgreSQL, and cannot obtain another tenant's data, an unlisted
path, a mismatched revision or content after authorization is revoked.

Keep Git authoritative. Cached artifact bytes are a disposable projection, not
permission, signature or evidence of current HEAD. No writes, new provider
permissions, real membership configuration, paid service or release is included.
