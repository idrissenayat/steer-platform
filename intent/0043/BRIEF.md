# Brief

The production gate boundary needs stricter policy checks than the fixture
prototype's signer helper. In particular, different sessions alone do not prove
that Gate 3 followed its exact build Critic, and one new session must not hide
another reused Gate 2 session. Missing domain assurance must never look green.

Implement deterministic checks over normalized evidence first, with an explicit
sourceVerificationRequired marker on every result. Keep provider identity,
qualification, signature proof, current source and authorization verification
separate; this evaluator must not become a public approval endpoint.
