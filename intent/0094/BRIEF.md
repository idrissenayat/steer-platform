# Brief

A retained failed/rolled-back contract attempt carries an unsigned human audit
clock. A later retry has a different audit time. Rewriting the old clock would
break exact stored-prefix continuity; forcing every clock to equal the newest
one makes an otherwise currently valid prefix unverifiable.

Add explicit current-audit entry points that preserve original bytes and recheck
every signed native/current proof through the existing complete verifier. Keep
original-as-of claims separate, preserve old APIs and enforce one-request ownership
of contract-human decision identities across retained failures and retries.
