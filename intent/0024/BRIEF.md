# Intent

Compose the verified identity API and owned session resources into a service that
can stop safely. Reject mismatched resource bindings and new work during shutdown.
Do not equate a closed pool or finished cleanup callback with a fully stopped
service while admitted requests are still running.

Preserve dependency inversion: the API accepts a managed resource contract,
without importing the database driver/package or changing architectural layers.
