import { createRemoteJWKSet, customFetch, jwtVerify } from 'jose';
import { z } from 'zod';
import { principalSchema, type Principal } from '@steer/tool-registry';

const identifier = z.string().min(1).max(200).refine((value) => value === value.trim());
const httpsUrl = z.string().url().refine((value) => {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password && !url.hash && !url.search;
});
const configSchema = z.strictObject({
  issuer: httpsUrl,
  jwksUri: httpsUrl,
  audience: identifier,
  clientIds: z.array(identifier).min(1).max(100),
  maxTokenAgeSeconds: z.number().int().min(1).max(3600).default(300),
});
export type OidcConfiguration = z.input<typeof configSchema>;

const grantSchema = principalSchema.extend({
  issuer: httpsUrl,
  active: z.boolean(),
  validAfter: z.iso.datetime(),
});
export type AuthorizationRecord = z.infer<typeof grantSchema>;
export interface IdentityLookup {
  issuer: string;
  subject: string;
  organizationId: string;
}
export interface IdentityDependencies {
  /** Must return fresh, verified Git-derived membership/grants; never caller input. */
  resolveAuthorization: (identity: Readonly<IdentityLookup>) => Promise<unknown>;
  now?: () => Date;
  /** Transport seam for isolated JWKS tests; never selected from request data. */
  fetch?: typeof globalThis.fetch;
}

const claimsSchema = z.object({
  sub: identifier,
  iss: httpsUrl,
  iat: z.number().int().nonnegative(),
  exp: z.number().int().nonnegative(),
  azp: identifier,
  typ: z.literal('Bearer'),
  steer_org: identifier,
  steer_kind: z.enum(['human', 'agent']),
  steer_hats: principalSchema.shape.hats,
});

/** Keycloak-compatible access-token profile, isolated from domain and API code. */
export function createOidcAuthenticator(configuration: OidcConfiguration, dependencies: IdentityDependencies) {
  const validated = configSchema.safeParse(configuration);
  if (!validated.success) throw new Error('Invalid OIDC configuration.');
  const config = validated.data;
  const clock = dependencies.now ?? (() => new Date());
  const transport = dependencies.fetch ?? globalThis.fetch;
  const jwks = createRemoteJWKSet(new URL(config.jwksUri), {
    timeoutDuration: 5000,
    cooldownDuration: 30000,
    cacheMaxAge: 300000,
    [customFetch]: (url, options) => transport(url, { ...options, redirect: 'error' }),
  });

  return async function authenticate(request: Request): Promise<Principal | null> {
    const header = request.headers.get('authorization');
    if (!header || header.length > 16384) return null;
    const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(header);
    if (!match?.[1]) return null;
    try {
      const now = clock();
      if (!Number.isFinite(now.getTime())) return null;
      const { payload } = await jwtVerify(match[1], jwks, {
        issuer: config.issuer,
        audience: config.audience,
        algorithms: ['RS256'],
        requiredClaims: ['sub', 'iss', 'aud', 'iat', 'exp'],
        maxTokenAge: config.maxTokenAgeSeconds,
        currentDate: now,
        clockTolerance: 0,
      });
      const claims = claimsSchema.safeParse(payload);
      if (!claims.success) return null;
      const token = claims.data;
      if (!config.clientIds.includes(token.azp) || token.exp <= token.iat ||
          token.exp - token.iat > config.maxTokenAgeSeconds ||
          token.iat * 1000 > now.getTime()) return null;
      const record = grantSchema.safeParse(await dependencies.resolveAuthorization({
        issuer: token.iss, subject: token.sub, organizationId: token.steer_org,
      }));
      if (!record.success) return null;
      const grant = record.data;
      // Recheck time after asynchronous authorization lookup; a slow source must not
      // extend a token or grant that expired while the request was waiting.
      const decisionTime = clock().getTime();
      const expiry = Math.min(token.exp * 1000, Date.parse(grant.expiresAt));
      if (!Number.isFinite(decisionTime) || decisionTime < now.getTime() ||
          !grant.active || expiry <= decisionTime ||
          grant.issuer !== token.iss || grant.subject !== token.sub ||
          grant.organizationId !== token.steer_org || grant.type !== token.steer_kind ||
          Date.parse(grant.validAfter) > token.iat * 1000 ||
          (grant.type === 'agent' && (grant.hats.length !== 0 || token.steer_hats.length !== 0))) return null;
      return principalSchema.parse({
        subject: grant.subject, organizationId: grant.organizationId, type: grant.type,
        hats: grant.hats.filter((hat) => token.steer_hats.includes(hat)),
        toolGrants: grant.toolGrants,
        expiresAt: new Date(expiry).toISOString(),
      });
    } catch {
      // No JWT, claim, URL, key-service error, or authorization record reaches logs.
      return null;
    }
  };
}
