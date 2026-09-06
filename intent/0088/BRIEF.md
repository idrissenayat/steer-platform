# Brief

Full reference lifecycle integration needs to prove which copy content is disposed
and which tombstone record preserves verification. The original generic copy and
tombstone resource schemas do not explicitly include those fields. They must not
be omitted or routed around the shared authorization verifier.

Introduce a trusted reference-only manifest/context profile using the identical
credential, delegation, authority, provider, replay/CAS and timing verification
body. Preserve original policy outputs and keep all executions disabled.
