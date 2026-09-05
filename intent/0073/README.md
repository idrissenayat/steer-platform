# 0073 · Pre-terminal raw grant evidence

Adds an offline verifier for one complete human raw-policy grant over an exact
prepared inventory, signed before the named sanitization terminal event. It
binds facts available at approval time, not future state or receipt bytes.

This verifies grant eligibility only. It never authorizes execution, consumes
the grant, replaces current holds/references, or changes the existing 0061 raw
action path by itself. The subsequent 0074 increment now composes this helper
with actual lifecycle and original/current batch evidence; see `intent/0074/SPEC.md`.
Read BRIEF, SPEC, PLAN, development ACCEPTANCE and EVIDENCE.
