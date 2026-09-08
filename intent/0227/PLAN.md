# Plan

1. Define strict read input/output and truthful status/role invariants.
2. Implement an owner-bound current-authority query over existing encrypted stores.
3. Extract pure recorded-exchange verification from the existing runtime codec and
   compose it in the API without dispatch capabilities or secrets.
4. Exercise the real HTTP handler, SQL/encryption and recorded SDK composition using
   synthetic transport; test denial, uncertainty, expiry, supersession and limits.
5. Verify scoped regressions, full typecheck, frontend build, protected documents,
   kit/security and migration holds. Document and push only owned changes.

Next: implement recorded-development submission under current service authority and
connect the actual editor's start/progress/result/recovery path. Complete owned-draft
discovery and full-corpus semantic review. Preserve the independent approval
requirements for real records activation, model usage and runtime Git saving.
