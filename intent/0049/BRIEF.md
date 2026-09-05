# Brief

Make the existing reference snapshot/change delivery usable in the authenticated
browser without inventing business statuses or trusting browser scope as authority.
Allow explicit repository selection, load, refresh and clearing. Show reference
keys and fingerprints as plain text, with clear limitations and accessible controls.

Keep credentials server-side, constrain HTTP requests and response resources,
discard stale/denied results, and verify against real local identity/Git/database
fixtures through the actual compiled Next.js client. No production provider access.
