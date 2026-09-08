# Implementation plan

1. Implement the verbatim content contract and encrypted immutable revision store.
2. Prove exact reconstruction, source/final-scope dependencies, concurrent parent
   conflict, idempotency, old acknowledgements, lifecycle/key denial and corruption.
3. Feed a reopened stored snapshot into candidate admission and the existing
   disposable Temporal/native-Git workflow tests.
4. Run regressions, update evidence, preserve the real migration hold and publish.

Next: authenticated generation-result/checkpoint provenance and durable Architect/
Test Agent execution, current source/authority composition and the actual editor's
acknowledgement/conflict/restore UI. D1 adoption, key/all-copy controls and explicit
live model/save authority remain separate activation prerequisites.
