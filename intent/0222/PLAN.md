# Plan

Scope check: 21 files including six intent records, delivery documentation and the
generated Drizzle snapshot. Runtime changes stay in one new data service/table;
worker and API changes are documentation/test composition only. The real migration
guard and signed architecture are outside the write scope.

1. Add two-stage immutable encrypted observation storage and scoped SQL isolation.
2. Test exact body/usage recovery, competing writers, conflicts, authorization,
   corruption, quarantine and lost commit acknowledgements.
3. Compose the actual step runner with SQL-backed observation verification in the
   synthetic model harness; retain explicit separation from a real provider.
4. Verify schema drift, migration isolation, regressions and protected sources;
   document and push owned development changes.

Next: bind actual model transport serialization/response parsing and usage capture
to this journal, without introducing retries or mixing secrets into records. Then
complete reference-only Temporal activities and editor/API recovery. Live model
spending and real records adoption remain separately gated; independent development
does not need another generic continue request.
