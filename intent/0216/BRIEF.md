# Brief

Checkpoint recovery must read stored results and keys without holding execution
locks or a database pool lease. Inspection found that the generic operation store
called `verifyCheckpoint` inside its transaction; a result reader using the same
single-connection pool could deadlock. Fix this composition boundary while retaining
exact owner/fence/input checks, current authority, budget limits and no effect replay.
