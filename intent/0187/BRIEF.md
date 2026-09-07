# Brief

Advance J1 by binding a signed policy selection to the selector's exact identity
coordinates and historical grant source, then checking both historical and current
permission through the existing Git authorization format. Current revocation must
deny, even when the old selection proof and historical grant remain valid.

Keep selected-key evidence distinct from approved ownership of the attestor/grant
sources and actual selector identity evidence. No live grant, new public action or
successful held-writer authority is installed by this development increment.
