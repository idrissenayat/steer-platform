# Brief

STEER needs a shared authorized boundary for requesting durable reconciliation,
not just a trusted internal client. Humans and agents should use the same tool
contracts through internal calls, HTTP and MCP. The runtime fixes the exact item
scope, routing and work limits, while current grants control each invocation.

A start can succeed even if its response is lost. Preserve that uncertainty,
provide a separately authorized status query and never automatically replay the
command or infer a gate decision from workflow completion.
