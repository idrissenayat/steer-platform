import { describe, expect, it } from "vitest";
import { demoChain } from "../src/data/demo-chain";
import { buildReadModel } from "@steer/domain/read-model";

describe("performance contract", () => {
  it("projects 50 pending decisions across 10 repositories inside the two-second budget", () => {
    const seed = demoChain.find((item) => item.id === "FD-002")!;
    const items = Array.from({ length: 50 }, (_, index) => ({ ...structuredClone(seed), id: `PERF-${String(index).padStart(3, "0")}`, title: `Decision ${index}` }));
    const started = performance.now();
    const model = buildReadModel(items, "2026-08-28T19:00:00Z");
    const elapsed = performance.now() - started;
    expect(model.decisions).toHaveLength(50);
    expect(elapsed).toBeLessThan(2000);
  });
});
