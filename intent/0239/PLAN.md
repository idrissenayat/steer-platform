# Plan

1. Add exact response-bound checkpoint references and two-pass completion without
   holding database leases over verification or creating a second result copy.
2. Connect current encrypted observation readback and the mandatory SDK verifier;
   preserve uncertain/failed states and exact no-rewrite success replay.
3. Add SQL completion/lifecycle guards without broad private-record access.
4. Test actual SQL/SDK success, restart, lost ACK, absent/incorrect evidence,
   revocation, quarantine races, restricted roles, shadow relations, lock contention
   and timed-out admission. Run compatibility, build and governance checks.
5. Document observed results, commit/push only verified owned files, then continue
   reference-only scope Temporal and completed-batch consumption under real authority.
   Keep records/model/save activation and live acceptance separate.
