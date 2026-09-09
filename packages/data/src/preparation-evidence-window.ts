type Read = () => Promise<unknown>;
type Track = <T>(pending: Promise<T>) => Promise<T>;
export type PreparationEvidenceWindow = (work: (read: Read) => Promise<void>) => Promise<void>;
const unavailable = () => new Error('Preparation evidence validation is unavailable.');

/** Private read-only validation boundary. The owner performs admission/persistence
 * only AFTER this returns, and opens a fresh window after each effect. Track is
 * owner bookkeeping and must retain actual pending work; it grants no authority. */
export async function withPreparationEvidence(window: PreparationEvidenceWindow | undefined,
  fallback: Read, work: (read: Read) => Promise<void>, track: Track, guard: () => void): Promise<void> {
  if (!window) { guard(); await track(work(fallback)); guard(); return; }
  let closed = false, failed = false, calls = 0, completed = false, reads = 0;
  let workFailed = false, workError: unknown;
  let running: Promise<void> | undefined;
  const check = () => { guard(); if (closed || failed) throw unavailable(); };
  const run = (read: Read) => {
    try { check(); if (++calls !== 1 || typeof read !== 'function') throw unavailable(); }
    catch { failed = true; const denied = Promise.reject<void>(unavailable()); void denied.catch(() => {}); return denied; }
    const readCurrent = () => {
      const pending = Promise.resolve().then(async () => {
        check(); if (reads) throw unavailable(); reads++;
        try { const value = await read(); check(); return value; }
        finally { reads--; }
      }).catch(error => { failed = true; throw error; });
      const owned = track(pending); void owned.catch(() => {}); return owned;
    };
    const pending = Promise.resolve().then(async () => {
      check(); if (await work(readCurrent) !== undefined) throw unavailable(); check();
      if (reads) throw unavailable(); completed = true;
    }).catch(error => { workFailed = true; workError = error; throw error; });
    running = track(pending); void running.catch(() => {}); return running;
  };
  try {
    check();
    if (await track(Promise.resolve().then(() => window(run))) !== undefined) throw unavailable();
    check();
    // A skipped/replayed callback, swallowed failure or early wrapper return is
    // not completed validation. Retained work still owns the caller's lease.
    if (calls !== 1 || !completed || !running || reads) throw unavailable();
    await running; check();
  } catch (error) {
    // The trusted corpus session sanitizes failures, but the owner still needs
    // its own exact draft/source Conflict classification before any effect.
    if (workFailed) throw workError;
    throw error;
  } finally { closed = true; }
}
