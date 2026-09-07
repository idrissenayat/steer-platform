# Brief

Normal recorded dispatch correctly refuses to reuse a failed run, but that leaves
projection without an explicit recovery path. Add a bounded internal recovery
primitive that preserves the original save and failed workflow, verifies the exact
current failed original run and reuses idempotent receipt/Git/SQL reconciliation.

This increment must not make ordinary start a retry, reset any workflow or admit a
new save operation. Current public recovery authorization and owned dispatch runtime
are separate follow-on work; no live route or permission is enabled here.
