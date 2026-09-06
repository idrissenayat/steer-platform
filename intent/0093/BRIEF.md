# Brief

A valid migration chain is not proof that its checkpoint was stored or that a
retry after lost acknowledgment is harmless. Restart must bind actual retained
bytes and exact committed/current store records, while rejecting expired chain
approval evidence and avoiding a duplicate backfill or metadata commit.

Add read-only checkpoint-slot evidence composition using separate record,
storage, replay/CAS and transport trust domains. Preserve original signed bytes,
revalidate current eligibility and keep every output non-executing.
