# Intent

Handle database connections that fail between queries and services that need to
stop while work remains active. Never confuse a missing COMMIT acknowledgement
with proof that a write failed, or retry it automatically. Prove this using an
owned loopback protocol fault relay and disposable synthetic database records.
