# Brief

The transactional projection feed needs an authorized shared tool so browser
and agent consumers follow one contract. Keep pages reference-only, require a
fixed trusted repository binding and explicit current grants, and reauthorize
after I/O before returning either references or a cursor-reset response.

Do not let an empty result conceal a broken cursor, or let a valid cursor become
a bearer credential. Existing artifact-path grants do not imply repository-wide
feed access. No live feature activation or new provider permission is inferred.
