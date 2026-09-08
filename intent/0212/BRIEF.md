# Brief

Record a verified candidate save as a durable result checkpoint without repeating
the provider write or mistaking a read/status request for permission to mutate
execution metadata. Recover lost checkpoint acknowledgements using original exact
receipt evidence while preserving failures, quarantine and existing authority limits.
