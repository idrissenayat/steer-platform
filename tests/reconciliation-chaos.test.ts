import { describe, expect, it } from "vitest";
import { demoChain } from "../src/data/demo-chain";
import { reconcileProjection, replayEvents } from "@steer/domain/replay";
import type { ProjectionEvent } from "@steer/domain/types";

describe("reconciliation chaos", () => {
  it("heals a deterministic five-percent event drop inside the ten-minute budget", () => {
    const authoritative = Array.from({ length: 100 }, (_, index) => ({ ...structuredClone(demoChain[index % demoChain.length]), id: `CHAOS-${String(index).padStart(3, "0")}` }));
    const allEvents: ProjectionEvent[] = authoritative.map((item, index) => ({ id: `event-${index}`, item, occurredAt: "2026-08-28T10:00:00Z", sequence: index + 1 }));
    const droppedFivePercent = allEvents.filter((_event, index) => index % 20 !== 0);
    const started = performance.now();
    const healed = reconcileProjection(droppedFivePercent, authoritative, "2026-08-28T10:09:00Z");
    const elapsed = performance.now() - started;
    expect(replayEvents(healed)).toEqual(authoritative);
    expect(healed).toHaveLength(100);
    expect(elapsed).toBeLessThan(10 * 60 * 1000);
  });
});
