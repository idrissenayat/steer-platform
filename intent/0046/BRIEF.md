# Brief

An initial reference view and a later separately read cursor can miss updates.
Read both under one PostgreSQL statement snapshot so a concurrent transaction
is either reflected in the snapshot and checkpoint, or available after it.
Expose the result through the same scoped, pre/post-authorized HTTP/MCP path.

Refuse oversized inventories instead of presenting partial results as complete.
Preserve an absent stream as null, not an invented generation or approval state.
