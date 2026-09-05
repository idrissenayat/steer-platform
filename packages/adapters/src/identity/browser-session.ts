import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, customFetch, jwtVerify } from 'jose';
import { z } from 'zod';
import { type Principal } from '@steer/tool-registry';
import { transactionSchema, sessionSchema, type BrowserSessionStore } from '@steer/tool-registry/browser-session';
export type { LoginTransaction, BrowserSession, BrowserSessionStore } from '@steer/tool-registry/browser-session';
import { createOidcAuthenticator, type IdentityDependencies } from './oidc.ts';

const https = z.string().url().refine((value) => {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash;
});
const configSchema = z.strictObject({
  issuer: https, jwksUri: https, authorizationEndpoint: https, tokenEndpoint: https,
  redirectUri: https, clientId: z.string().regex(/^[A-Za-z0-9_.-]{1,200}$/),
  clientSecret: z.string().min(16).max(2000), audience: z.string().min(1).max(200),
});
export type BrowserSessionConfiguration = z.infer<typeof configSchema>;
const opaque = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export class BrowserSessionError extends Error {
  constructor() { super('The sign-in operation could not be completed.'); }
}
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const secret = () => randomBytes(32).toString('base64url');
const loginCookie = '__Host-steer-login';
const sessionCookie = '__Host-steer-session';
function cookie(name: string, value: string, seconds: number) {
  return `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${seconds}`;
}
function parseCookie(header: string | null, name: string): string | null {
  if (!header || header.length > 8192) return null;
  const matches = header.split(';').map((part) => part.trim()).filter((part) => part.startsWith(`${name}=`));
  if (matches.length !== 1) return null;
  const parsed = opaque.safeParse(matches[0]?.slice(name.length + 1));
  return parsed.success ? parsed.data : null;
}
async function tokenJson(response: Response) {
  if (!response.ok || response.redirected || !response.body) throw new BrowserSessionError();
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const next = await reader.read(); if (next.done) break;
      size += next.value.byteLength;
      if (size > 65536) { await reader.cancel(); throw new BrowserSessionError(); }
      chunks.push(next.value);
    }
    return z.object({ access_token: z.string().min(1).max(16384), id_token: z.string().min(1).max(16384),
      token_type: z.literal('Bearer') }).parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))));
  } finally { reader.releaseLock(); }
}

/** Confidential-client code/PKCE broker. HTTP routes must never serialize its store. */
export function createBrowserSessionBroker(raw: BrowserSessionConfiguration, dependencies: IdentityDependencies & { store: BrowserSessionStore }) {
  const parsed = configSchema.safeParse(raw);
  if (!parsed.success) throw new BrowserSessionError();
  const config = parsed.data;
  const issuerOrigin = new URL(config.issuer).origin;
  if ([config.jwksUri, config.authorizationEndpoint, config.tokenEndpoint].some((url) => new URL(url).origin !== issuerOrigin)) throw new BrowserSessionError();
  const callback = new URL(config.redirectUri);
  const clock = dependencies.now ?? (() => new Date());
  const transport = dependencies.fetch ?? globalThis.fetch;
  const store = dependencies.store;
  const now = () => { const time = clock().getTime(); if (!Number.isFinite(time)) throw new BrowserSessionError(); return time; };
  const authenticateAccess = createOidcAuthenticator({ issuer: config.issuer, jwksUri: config.jwksUri,
    audience: config.audience, clientIds: [config.clientId], maxTokenAgeSeconds: 300 }, dependencies);
  const jwks = createRemoteJWKSet(new URL(config.jwksUri), { timeoutDuration: 5000,
    [customFetch]: (url, options) => transport(url, { ...options, redirect: 'error' }) });
  const validateAccess = (accessToken: string) => authenticateAccess(new Request(config.redirectUri, { headers: { authorization: `Bearer ${accessToken}` } }));
  const safely = async <T>(run: () => Promise<T>): Promise<T> => { try { return await run(); } catch { throw new BrowserSessionError(); } };
  return {
    begin: (requestOrigin: string | null) => safely(async () => {
      if (requestOrigin !== callback.origin) throw new BrowserSessionError();
      const createdAt = now(); const state = secret(); const browser = secret();
      const verifier = secret(); const nonce = secret();
      if (!await store.insertTransaction(digest(state), { browserHash: digest(browser), verifier, nonce, createdAt, expiresAt: createdAt + 300000 })) throw new BrowserSessionError();
      const url = new URL(config.authorizationEndpoint);
      url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri,
        response_type: 'code', response_mode: 'query', scope: 'openid', state, nonce,
        code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' }).toString();
      return { authorizationUrl: url.toString(), setCookie: cookie(loginCookie, browser, 300) };
    }),
    complete: (callbackUrl: string, cookieHeader: string | null) => safely(async () => {
      if (callbackUrl.length > 8192) throw new BrowserSessionError();
      const url = new URL(callbackUrl);
      if (url.origin !== callback.origin || url.pathname !== callback.pathname || url.hash || url.username || url.password) throw new BrowserSessionError();
      const query = url.searchParams;
      if ([...query.keys()].some((key) => !['code', 'state', 'iss', 'session_state'].includes(key) || query.getAll(key).length !== 1)) throw new BrowserSessionError();
      const state = opaque.parse(query.get('state')); const browser = parseCookie(cookieHeader, loginCookie);
      const transaction = transactionSchema.parse(await store.consumeTransaction(digest(state)));
      const time = now();
      if (!browser || transaction.browserHash !== digest(browser) || time < transaction.createdAt || time >= transaction.expiresAt ||
          transaction.expiresAt - transaction.createdAt !== 300000 || query.get('iss') !== config.issuer) throw new BrowserSessionError();
      const code = z.string().min(1).max(4096).refine((value) => !/[\u0000-\u001f\u007f]/.test(value)).parse(query.get('code'));
      const formEncode = (value: string) => new URLSearchParams({ v: value }).toString().slice(2);
      const tokens = await tokenJson(await transport(config.tokenEndpoint, { method: 'POST',
        redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000),
        headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json',
          authorization: `Basic ${Buffer.from(`${formEncode(config.clientId)}:${formEncode(config.clientSecret)}`).toString('base64')}` },
        body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: config.redirectUri,
          code_verifier: transaction.verifier }).toString() }));
      const { payload } = await jwtVerify(tokens.id_token, jwks, { issuer: config.issuer, audience: config.clientId,
        algorithms: ['RS256'], requiredClaims: ['sub', 'iss', 'aud', 'iat', 'exp', 'nonce'],
        maxTokenAge: 300, currentDate: new Date(now()), clockTolerance: 0 });
      if (payload.nonce !== transaction.nonce || (payload.azp !== undefined && payload.azp !== config.clientId) ||
          (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== config.clientId) ||
          typeof payload.exp !== 'number' || typeof payload.iat !== 'number' || payload.exp <= payload.iat ||
          payload.exp - payload.iat > 300) throw new BrowserSessionError();
      if (payload.at_hash !== undefined && payload.at_hash !== createHash('sha256').update(tokens.access_token).digest().subarray(0, 16).toString('base64url')) throw new BrowserSessionError();
      const principal = await validateAccess(tokens.access_token);
      const decision = now();
      if (!principal || principal.type !== 'human' || principal.subject !== payload.sub || decision < time || decision >= transaction.expiresAt) throw new BrowserSessionError();
      const expiresAt = Math.min(Date.parse(principal.expiresAt), payload.exp * 1000);
      if (expiresAt <= decision) throw new BrowserSessionError();
      const sessionId = secret();
      if (!await store.insertSession(digest(sessionId), { accessToken: tokens.access_token, subject: principal.subject,
        organizationId: principal.organizationId, createdAt: decision, expiresAt })) throw new BrowserSessionError();
      return { setCookies: [cookie(loginCookie, '', 0), cookie(sessionCookie, sessionId, Math.floor((expiresAt - decision) / 1000))],
        expiresAt: new Date(expiresAt).toISOString() };
    }),
    authenticate: async (cookieHeader: string | null): Promise<Principal | null> => {
      try {
        const id = parseCookie(cookieHeader, sessionCookie); if (!id) return null;
        const key = digest(id); const session = sessionSchema.parse(await store.readSession(key));
        const started = now();
        if (started < session.createdAt || started >= session.expiresAt || session.expiresAt - session.createdAt > 300000) return null;
        const principal = await validateAccess(session.accessToken);
        const current = sessionSchema.safeParse(await store.readSession(key));
        const decision = now();
        if (!principal || principal.type !== 'human' || principal.subject !== session.subject || principal.organizationId !== session.organizationId ||
            !current.success || JSON.stringify(current.data) !== JSON.stringify(session) || decision < started ||
            decision >= Math.min(session.expiresAt, Date.parse(principal.expiresAt))) return null;
        return { ...principal, expiresAt: new Date(Math.min(Date.parse(principal.expiresAt), session.expiresAt)).toISOString() };
      } catch { return null; }
    },
    logout: (cookieHeader: string | null, requestOrigin: string | null) => safely(async () => {
      if (requestOrigin !== callback.origin) throw new BrowserSessionError();
      const id = parseCookie(cookieHeader, sessionCookie);
      if (id) await store.deleteSession(digest(id));
      return { setCookies: [cookie(loginCookie, '', 0), cookie(sessionCookie, '', 0)] };
    }),
  };
}
