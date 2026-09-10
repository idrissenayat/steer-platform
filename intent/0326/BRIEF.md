# 0326 — Preserve and recover scope/drafting originals once

Reduce repeated restoration during scope and drafting preparation while retaining
their distinct preservation and read permissions. The existing put path already
restores the stored original to verify it; a server-only joined method can return
that result only after independently checking the additional read purpose.

Keep the legacy acknowledgement-only API unchanged. Preserve exact source,
encrypted-original immutability, current lifecycle/key checks, effect-separated
revalidation and uncertain-outcome recovery. This advances partial C22 work; it
does not complete performance or real-user acceptance or authorize live access.
