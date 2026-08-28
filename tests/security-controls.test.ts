import { describe, expect, it } from "vitest";
import { auditTokenScopes, EphemeralOriginatorSession, ReplayGuard, scrubLog, verifyWebhookSignature } from "../src/security/controls";

async function signature(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
  return `sha256=${[...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

describe("default-closed security and privacy controls", () => {
  it("accepts authentic webhooks and rejects forged signatures", async () => {
    const payload = JSON.stringify({ revision: "abc123" });
    const valid = await signature(payload, "shared-secret");
    expect(await verifyWebhookSignature(payload, valid, "shared-secret")).toBe(true);
    expect(await verifyWebhookSignature(payload, "sha256=forged", "shared-secret")).toBe(false);
  });

  it("rejects a replayed delivery id", () => {
    const guard = new ReplayGuard();
    expect(guard.accept("delivery-1", 1000)).toBe(true);
    expect(guard.accept("delivery-1", 1001)).toBe(false);
  });

  it("fails the scope audit when a broader credential is requested", () => {
    expect(auditTokenScopes(["contents:read", "pull_requests:write"])).toEqual({ valid: true, forbidden: [] });
    expect(auditTokenScopes(["contents:read", "repo:admin"])).toEqual({ valid: false, forbidden: ["repo:admin"] });
  });

  it("scrubs secrets, tokens, originator text, and seeded canaries from logs", () => {
    const scrubbed = scrubLog({ token: "top-secret", detail: "CANARY-ORIGINATOR", nested: { problemText: "private problem" } }, ["CANARY-ORIGINATOR"]);
    expect(JSON.stringify(scrubbed)).not.toContain("top-secret");
    expect(JSON.stringify(scrubbed)).not.toContain("CANARY-ORIGINATOR");
    expect(JSON.stringify(scrubbed)).not.toContain("private problem");
  });

  it("clears originator text immediately after the artifact write", () => {
    const session = new EphemeralOriginatorSession();
    session.setProblem("sensitive originator context");
    expect(session.commit((text) => text.toUpperCase())).toBe("SENSITIVE ORIGINATOR CONTEXT");
    expect(session.context()).toBe("");
  });
});
