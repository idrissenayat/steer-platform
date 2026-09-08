# Acceptance boundary

Developer tests use actual installed Mastra/OpenAI-compatible SDKs, actual SQL and
encryption, and a synthetic fetch response. No OpenAI/LiteLLM service is contacted;
model quality, billing, hosted retention, production profile/routing and independent
Test Agent/human acceptance are unverified. Actual request serialization, protocol
parsing and SQL correspondence are tested, not cryptographic provider authorship.

Reconstruction occurs within the test process and running database. It is not a
machine/backup restore. The legacy application runtime is unchanged and no new
binding is installed in the real UI. D1 and live model/save authority remain held;
I1–I6 are incomplete. No real migration, gate, deployment, deletion or paid test.
