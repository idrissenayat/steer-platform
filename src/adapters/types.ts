import type { GateActionResult } from "../domain/actions";
import type { GateAction, IdentityContext, ProjectionEvent, WorkItemChain } from "../domain/types";

export interface ReconciliationResult {
  events: ProjectionEvent[];
  repairedItems: number;
}

export interface ChainAdapter {
  readonly id: string;
  snapshot(): Promise<WorkItemChain[]>;
  events(): Promise<ProjectionEvent[]>;
  reconcile(at: string): Promise<ReconciliationResult>;
  recordDecision(actor: IdentityContext, action: GateAction): Promise<GateActionResult>;
}
