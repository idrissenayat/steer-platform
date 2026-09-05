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
