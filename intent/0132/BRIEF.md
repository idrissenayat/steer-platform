# Brief

The shared save tool and GitHub storage primitive exist, but storage alone does
not authenticate its caller or bind repeated checks to one human session.

Provide a request-scoped BriefWriter so the canonical preview/confirmation/save/
status tools can use the actual storage adapter without trusting browser identity
facts or a cached authority receipt. Preserve exact-head create-only behavior and
uncertain-outcome recovery. Keep live saving closed until its missing full
source-backed verifier, accepted gate evidence and explicit provider scope exist.

This increment does not change signed Phase 1 scope, approve a gate, install a
writer in the runtime, change GitHub permissions or add browser save controls.
