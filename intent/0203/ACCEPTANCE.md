# Development acceptance

- [x] Versioned isolated accounting schema and append-only runtime permissions.
- [x] Owner/configuration/approval/cost mismatch and expiry deny reservation.
- [x] Parallel clients cannot exceed the shared cap, including contaminated isolation defaults.
- [x] Separate role costs are counted exactly; reconstruction cannot reset the ledger.
- [x] Unknown commit acknowledgement permits no call and does not refund a committed row.
- [x] Real disposable PostgreSQL integration checks pass.
- [ ] Approved live budget, verified model-cost bounds and explicit local runtime binding.
- [ ] Provider billing/recovery reconciliation and duplicate-request prevention.
- [ ] Real-model and actual human UI journey acceptance.
