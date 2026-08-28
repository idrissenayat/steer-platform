const encoder = new TextEncoder();

function hex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function verifyWebhookSignature(payload: string, header: string, secret: string): Promise<boolean> {
  if (!header.startsWith("sha256=") || !secret) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return constantTimeEqual(`sha256=${hex(new Uint8Array(signature))}`, header.toLowerCase());
}

export class ReplayGuard {
  #seen = new Map<string, number>();
  constructor(private readonly ttlMilliseconds = 10 * 60 * 1000) {}

  accept(deliveryId: string, now = Date.now()): boolean {
    for (const [id, expiresAt] of this.#seen) if (expiresAt <= now) this.#seen.delete(id);
    if (!deliveryId || this.#seen.has(deliveryId)) return false;
    this.#seen.set(deliveryId, now + this.ttlMilliseconds);
    return true;
  }
}

const sensitiveKeys = /authorization|cookie|secret|token|problem.?text|originator.?text/i;

export function scrubLog(value: unknown, canaries: string[] = []): unknown {
  if (typeof value === "string") {
    return canaries.reduce((text, canary) => canary ? text.replaceAll(canary, "[REDACTED]") : text, value);
  }
  if (Array.isArray(value)) return value.map((entry) => scrubLog(entry, canaries));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, sensitiveKeys.test(key) ? "[REDACTED]" : scrubLog(entry, canaries)]));
  }
  return value;
}

export function auditTokenScopes(requested: string[]): { valid: boolean; forbidden: string[] } {
  const allowed = new Set(["contents:read", "checks:read", "pull_requests:read", "pull_requests:write", "statuses:read", "statuses:write"]);
  const forbidden = [...new Set(requested.filter((scope) => !allowed.has(scope)))].sort();
  return { valid: forbidden.length === 0, forbidden };
}

export class EphemeralOriginatorSession {
  #problemText = "";
  setProblem(text: string) { this.#problemText = text; }
  context() { return this.#problemText; }
  clear() { this.#problemText = ""; }
  commit<T>(write: (problemText: string) => T): T {
    try { return write(this.#problemText); } finally { this.clear(); }
  }
}
