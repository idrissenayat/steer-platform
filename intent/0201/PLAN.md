# Implementation plan

1. Define portable proposal validation and exact-review binding.
2. Mount direction/reason controls with a fresh authorized read before confirmation.
3. Test stale sources, wrong targets, changed reasons and non-authority behavior.
4. Build, restore the owned local services, document boundaries and verify the push.

Continue I1 configuration/semantic review and connect I2 proposals to server-side
draft/save orchestration. Durable retention of intent, explanation and documents
remains I4 work; current session-clearing behavior is not lossless acceptance.
