# Plan

1. Implement strict bounded UTC parsing/formatting with BigInt nanoseconds.
2. Implement exact seconds/days/calendar years and parent-cap arithmetic.
3. Adopt precise key-window checks and the public retention boundary helper;
   bind the new time semantics in all affected candidate policy digests.
4. Test one-nanosecond boundaries, epochs/year endpoints, leap dates, invalid
   grammar, overflow and continued denial of unsupported composed inputs.
5. Run repository checks, update documentation and verify the authorized push.

Next: explicit successor event/business time contracts and future-key/archival
retention semantics, reference-revocation completion, full raw-key/grant coverage,
then remaining migration and normative evidence before independent review.
