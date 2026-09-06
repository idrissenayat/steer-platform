# Brief

An internally consistent sequence is not necessarily the latest stored sequence.
Require a separately selected fresh query and complete readback evidence for the
canonical head and exact retained object. Recheck the head after reading the
object so a changed source state is not silently accepted.

Preserve original checkpoints and 0095 behavior. Bind every observation to the
trusted challenge, scope and current evaluation time. Treat unknown/pre-commit
outcomes as blocked, not permission to retry an effect or resume a migration.
