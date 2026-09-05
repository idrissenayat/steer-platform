# Brief

Recreating an SDK object in one process is insufficient crash-recovery evidence.
Run the real worker/data composition in an owned child process, kill that process
during a durable wait, and resume with a different PID while the Temporal server
and PostgreSQL survive. Verify current Git authority is reread after restart.

Provide a reusable service lifecycle for explicit startup and ordered cleanup,
including shutdown during initialization and safe failure reporting. Keep test
credentials isolated and avoid automatic retry, gate or deployment implications.
