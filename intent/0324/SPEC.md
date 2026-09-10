# 0324 — Preservation/readback contract

1. Factor candidate preservation into one internal operation. `put` retains its
   existing acknowledgement shape. The server-only `putAndRead` returns an
   immutable original only when the same full post-insert or existing-row
   recovery has verified ciphertext, exact admitted request, key bytes, current
   authority and final lifecycle/envelope state. Failed or uncertain outcomes
   contain no original. This is not a public tool or browser response.
2. Confirmation consumes that readback and compares it to the exact admitted
   request. Retain its initial preview, admission, pre-preservation draft checks
   and complete post-preservation draft/preview/draft recheck. No confirmation,
   source, publication or gate authority may be inferred from a stored record.
3. Candidate recovery synchronizes durable hold and shortened-expiry restrictions;
   it is not generally read-only. Keep both synchronizations within the single
   recovery. Do not cache its output, move it across effects or erase a latched
   restriction. Later independent reads still perform full recovery.
4. Keep unknown commit acknowledgements, immutable-row replay, concurrent insert
   handling, owner/tenant isolation, late denial and actual pending-key admission.
   This contract is specific to candidate originals' shared authorization ports;
   do not assume `put` authority covers separate `read` purposes in scope or
   development original stores.
5. Verify native old/new output equality and key/lifecycle work, late denial,
   durable hold/expiry latching, lost acknowledgements, concurrent inserts and
   timeout/close. Run both authenticated native save/reopen directions, focused
   and broad regression, types and kit/scope audit. Record whole-action counts;
   do not claim C22 without the unchanged full benchmark or live UI acceptance.
