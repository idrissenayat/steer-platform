# Brief

Connect the real configured SDK request and parsed response to the encrypted journal
and durable step runner. A stored observation must correspond to what the transport
actually sent/returned, not caller-assembled substitute content. Recovery verifies
that correspondence without sending the request again.
