import { z } from 'zod';

const time = z.number().int().nonnegative().max(8640000000000000);
const opaque = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const transactionSchema = z.strictObject({
  browserHash: z.string().regex(/^[a-f0-9]{64}$/), verifier: opaque, nonce: opaque,
  createdAt: time, expiresAt: time,
});
export const sessionSchema = z.strictObject({
  accessToken: z.string().min(1).max(16384), subject: z.string().min(1).max(200),
  organizationId: z.string().min(1).max(200), createdAt: time, expiresAt: time,
});
export type LoginTransaction = z.infer<typeof transactionSchema>;
export type BrowserSession = z.infer<typeof sessionSchema>;
/** Server-only, short-lived credentials. Never an authorization source. */
export interface BrowserSessionStore {
  /** Atomic insert-if-absent, with bounded TTL and capacity. */
  insertTransaction(key: string, value: LoginTransaction): Promise<boolean>;
  /** Atomic read-and-delete across processes, before code exchange. */
  consumeTransaction(key: string): Promise<unknown>;
  insertSession(key: string, value: BrowserSession): Promise<boolean>;
  readSession(key: string): Promise<unknown>;
  deleteSession(key: string): Promise<void>;
}
