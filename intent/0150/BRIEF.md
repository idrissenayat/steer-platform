# Brief

Destination unit and transport tests do not establish that an authenticated author
can observe source revisions through the composed identity service. In particular,
an admitted read still needs its session store for authorization after source I/O.
Exercise the actual chain and preserve that dependency during shutdown, without
enabling real providers, persistence, gate authority or writes.
