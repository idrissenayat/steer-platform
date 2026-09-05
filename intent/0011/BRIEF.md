# Brief

Turn verified Git artifact snapshots into recoverable tenant projections.
Repeated delivery must be harmless, racing older reads must not overwrite a
newer projection, and projection loss must be repairable from source bytes.
