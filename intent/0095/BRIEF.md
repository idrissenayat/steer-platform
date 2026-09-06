# Brief

The previous checkpoint candidate verifies one selected slot. A subsequent slot
must not reset its opening state, rewrite retained attempts or claim old work as
new progress. Compose complete prior readback evidence before accepting a strict
extension, including retained failed contract attempts with different audit clocks.

Preserve the original v1 single-slot profile. Select a separate current-observation
sequence policy and bind it, together with the predecessor, into every signed
source record. Keep live persistence and action authorization explicitly separate.
