/** Public display configuration only. This never grants access or configures the API. */
export function identityView(enabled: string | undefined, origin: string | undefined, issuer: string | undefined) {
  if (enabled !== 'enabled' || !origin || !issuer) return null;
  try {
    const app = new URL(origin); const provider = new URL(issuer);
    if (app.protocol !== 'https:' || app.origin !== origin || app.username || app.password ||
        provider.protocol !== 'https:' || provider.username || provider.password || provider.search || provider.hash) return null;
    return { origin: app.origin, issuerOrigin: provider.origin };
  } catch { return null; }
}

export interface SessionView { subject: string; organizationId: string; hats: string[]; expiresAt: string }
/** Fixed public repository display hint; API authorization remains independent. */
export function repositoryView(value: string | null): string | null {
  return value && /^[a-z][a-z0-9-]{0,31}:[A-Za-z0-9_-]{1,160}(?![\s\S])/.test(value) ? value : null;
}
/** Read only the private gateway's display header. This never grants a permission. */
export function sessionView(encoded: string | null, now = Date.now()): SessionView | null {
  if (!encoded || encoded.length > 8192 || !Number.isFinite(now)) return null;
  try {
    const value: unknown = JSON.parse(decodeURIComponent(encoded));
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const item = value as Record<string, unknown>;
    if (Object.keys(item).sort().join(',') !== 'expiresAt,hats,organizationId,subject') return null;
    const identifier = (input: unknown): input is string => typeof input === 'string' && input.length > 0 && input.length <= 200;
    if (!identifier(item.subject) || !identifier(item.organizationId) || !Array.isArray(item.hats) || item.hats.length > 8 ||
        !item.hats.every((hat) => typeof hat === 'string' && /^[a-z][a-z-]{0,99}$/.test(hat)) ||
        typeof item.expiresAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(item.expiresAt) ||
        !Number.isFinite(Date.parse(item.expiresAt)) || Date.parse(item.expiresAt) <= now) return null;
    return { subject: item.subject, organizationId: item.organizationId, hats: item.hats as string[], expiresAt: item.expiresAt };
  } catch { return null; }
}
