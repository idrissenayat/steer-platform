# Brief

The authenticated receipt job now has lifecycle and identity controls, but actual
database wiring remains in test setup. Add explicit runtime composition using the
existing bounded PostgreSQL pool, derived-data access and source adapters. Verify
the held receipt-to-source journey through this runtime, not a handwritten sink.
