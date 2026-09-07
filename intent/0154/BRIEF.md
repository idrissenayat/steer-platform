# Brief

The writer factory previously required a caller-supplied full gate verifier, while
the actual policy/source collectors remained separate. Connect them in one explicitly
held path so membership and complete source checks can be exercised together without
an arbitrary callback claiming that unfinished governance evidence is write authority.
This advances the approved overnight journey; it does not enable live saving.
