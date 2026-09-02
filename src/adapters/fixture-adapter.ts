import { applyGateAction } from "@steer/domain/actions";
import { reconcileProjection, replayEvents } from "@steer/domain/replay";
import type { GateAction, IdentityContext, ProjectionEvent, WorkItemChain } from "@steer/domain/types";
import type { ChainAdapter, ReconciliationResult } from "./types";

export class FixtureChainAdapter implements ChainAdapter {
  readonly id = "fixture";
  #authoritative: WorkItemChain[];
  #events: ProjectionEvent[];

  constructor(items: WorkItemChain[]) {
    this.#authoritative = structuredClone(items);
    this.#events = items.map((item, index) => ({
      id: `seed-${index + 1}-${item.id}`,
      item: structuredClone(item),
      occurredAt: item.artifacts.at(-1)?.updatedAt ?? "1970-01-01T00:00:00.000Z",
      sequence: index + 1,
    }));
  }

  async snapshot(): Promise<WorkItemChain[]> {
    return replayEvents(this.#events);
  }

  async events(): Promise<ProjectionEvent[]> {
    return structuredClone(this.#events);
  }

  async reconcile(at: string): Promise<ReconciliationResult> {
    const previous = this.#events.length;
    this.#events = reconcileProjection(this.#events, this.#authoritative, at);
    return { events: await this.events(), repairedItems: this.#events.length - previous };
  }

  async recordDecision(actor: IdentityContext, action: GateAction) {
    const result = applyGateAction(this.#authoritative, actor, action);
    if (!result.ok) return result;
    this.#authoritative = result.chain;
    this.#events.push({
      id: `decision-${this.#events.length + 1}-${result.item.id}`,
      item: structuredClone(result.item),
      occurredAt: action.at,
      sequence: this.#events.length + 1,
    });
    return result;
  }
}
