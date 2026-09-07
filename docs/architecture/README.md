# STEER platform architecture

Start with [the end-to-end blueprint](END-TO-END.md): the business process,
intent workflow, system architecture, responsibilities and current implementation
boundary. Its [workflow contract and decisions](WORKFLOW-CONTRACT.md) define
proposed state transitions, persistence, duplicate prevention and failure recovery.

The canonical production architecture for item 0001 remains
[Architecture revision 2](../../intent/0001/ARCHITECTURE.md). Its historical
“Gate 1 draft” header is preserved in the signed snapshot; the
[detached signature](../../intent/0001/signatures/gate-1.json) records approval at
`281c9736816ec22fa1209b060b58fa8164519f7c`. The phased PNG is that baseline's
visual projection, not proof that its components are live.

The September 7 blueprint adds an integration design for review. In particular,
durable operational-state semantics and protected candidate-bundle publication
remain proposed decisions, not silently adopted changes to the signed baseline.
No gate, spending or runtime write authorization changes with this package.

The original supplied files remain external source inputs. This directory holds
the corrected project version so Git records subsequent architecture decisions.
