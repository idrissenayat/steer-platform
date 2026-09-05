/** Coordinates owned resources without importing a workflow SDK or asserting business readiness. */
export function createWorkerService(dependencies: {
  createWorker(): Promise<{ run(): Promise<void>; shutdown(): void }>;
  runtime: { shutdown(): Promise<void> };
  closeConnection(): Promise<void>;
}) {
  let state: 'idle' | 'starting' | 'running' | 'stopping' | 'stopped' | 'failed' = 'idle';
  let worker: Awaited<ReturnType<typeof dependencies.createWorker>> | undefined;
  let completion: Promise<void> | undefined; let failed = false;
  let cleanup: Promise<void> | undefined;
  const stopping = () => state === 'stopping';
  const close = () => cleanup ??= (async () => {
    try { await dependencies.runtime.shutdown(); } catch { failed = true; }
    try { await dependencies.closeConnection(); } catch { failed = true; }
    state = failed ? 'failed' : 'stopped';
    if (failed) throw new Error('Worker service shutdown could not be confirmed.');
  })();
  return {
    start(): Promise<void> {
      if (state !== 'idle') return completion ?? Promise.reject(new Error('Worker service cannot start.'));
      state = 'starting';
      completion = (async () => {
        try {
          worker = await dependencies.createWorker();
          const stopRequested = stopping();
          if (!stopRequested) state = 'running';
          const run = worker.run();
          // The SDK only permits shutdown after run starts; a pending constructor must still be drained.
          if (stopRequested) { try { worker.shutdown(); } catch { failed = true; } }
          await run;
        } catch { failed = true; }
        state = 'stopping'; await close();
      })();
      return completion;
    },
    shutdown(): Promise<void> {
      if (state === 'idle') { state = 'stopping'; completion = close(); }
      else if (state === 'starting') state = 'stopping';
      else if (state === 'running') {
        state = 'stopping';
        try { worker!.shutdown(); } catch { failed = true; }
      }
      // Retain the actual worker execution and external job drain, even after SDK shutdown failure.
      return completion!;
    },
    status: () => ({ state }),
  };
}
