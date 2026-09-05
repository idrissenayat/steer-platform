# Brief

An item can wait for a human decision across worker restarts, but a workflow
must not adopt an old decision after the artifact changes or convert execution
state into business authority. Add a revision-bound observation workflow with
bounded polling, source checkpoints, explicit supersession and safe failure.

Keep source verification and signature policy outside Temporal. This foundation
uses a trusted observer port and synthetic source observations in verification;
it does not claim a completed Git signature-record verifier or event consumer.
