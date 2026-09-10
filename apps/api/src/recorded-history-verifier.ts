/** Compatibility entry for internal callers. Provider/storage composition lives
 * only in the API's declared runtime entry point, not a second composition root. */
export { createRecordedHistoryVerifier, createVerifiedRecordsContentReader } from './runtime.ts';
