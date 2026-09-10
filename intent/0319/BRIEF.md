# 0319 — Current-scope permission-query composition

Reduce the measured current-caller traversal in drafting start without permission
caching or weaker data/effect boundaries. On the 0318 repeated-start trace, 348
pre-policy and 348 post-policy identity calls dominate 1,069 requests. Apply the
existing permission-query ownership pattern to explicitly constructed current
source policies, keeping ordinary/generic/history callbacks unchanged.

No model call/spend, live artifact save, records/profile activation, release or
signature. Keep the fixed acceptance checklist and complete C22 limits unchanged.
