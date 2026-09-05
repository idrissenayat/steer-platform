import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import type { BrowserSessionStore, BrowserSession, LoginTransaction } from '@steer/adapters/browser-session';

export interface SessionTestHarness {
  kind: 'memory' | 'postgres';
  store: BrowserSessionStore;
  freshStore(): BrowserSessionStore;
  wrongKeyStore?: () => BrowserSessionStore;
  counts(): Promise<{ transactions: number; sessions: number }>;
  firstSession(): Promise<BrowserSession | undefined>;
  abandonTransactions(): Promise<void>;
  corruptVerifier(): Promise<void>;
  verifyCiphertext?: () => Promise<void>;
}

/** Explicit provider-only test fixture; never exported by a production package. */
export function createMemorySessionHarness(): SessionTestHarness {
  const transactions = new Map<string, LoginTransaction>(); const sessions = new Map<string, BrowserSession>();
  const store: BrowserSessionStore = {
    insertTransaction: async (key, value) => { if (transactions.has(key)) return false; transactions.set(key, value); return true; },
    consumeTransaction: async (key) => { const value = transactions.get(key); transactions.delete(key); return value; },
    insertSession: async (key, value) => { if (sessions.has(key)) return false; sessions.set(key, value); return true; },
    readSession: async (key) => sessions.get(key), deleteSession: async (key) => { sessions.delete(key); },
  };
  return { kind: 'memory', store, freshStore: () => ({ ...store }),
    counts: async () => ({ transactions: transactions.size, sessions: sessions.size }),
    firstSession: async () => [...sessions.values()][0],
    abandonTransactions: async () => { transactions.clear(); },
    corruptVerifier: async () => {
      assert.equal(transactions.size, 1);
      for (const value of transactions.values()) value.verifier = randomBytes(32).toString('base64url');
    },
  };
}
