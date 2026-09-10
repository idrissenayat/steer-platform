# 0329 — One draft snapshot across nested save reviews

Continue the combined preview/confirmation correction identified by the
[0328 trace](../0328/PROFILE.json). Keep the existing authenticated application,
signed requirements, real-data and spending boundaries.

Source review already owns a fully validated native draft phase, but final save
review and preview reopen that same draft repeatedly through ordinary public
reads. Lend that exact phase to the nested read-only consumers, preserving each
consumer's current-caller checks and the owner's full final native verification.

Success means identical review/preview output and recovery behavior with fewer
whole-action requests. No loan crosses confirmation, admission, preservation,
scheduling or a request boundary. Other reader instances and revisions retain
their complete ordinary path. C22 and live UI acceptance are not inferred.

See [Spec](SPEC.md), [evidence](EVIDENCE.md) and the
[fixed progress tracker](../../docs/INTENT-CAPTURE-PROGRESS.md).
