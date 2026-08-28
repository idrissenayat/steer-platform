import { buildReadModel, artifactRevisionForGate } from "./read-model";
import type {
  FlightStage,
  Gate,
  GateAction,
  IdentityContext,
  WorkItemChain,
} from "./types";

export type GateActionResult =
  | { ok: true; chain: WorkItemChain[]; item: WorkItemChain }
  | {
      ok: false;
      code: "decision-not-found" | "not-authorized" | "note-required" | "stale-revision";
      message: string;
      currentRevision?: string;
    };

const sendBackRoutes: Record<Gate, FlightStage> = {
  1: "sense",
  2: "frame-intent",
  3: "engineer",
};

export function applyGateAction(
  chain: WorkItemChain[],
  actor: IdentityContext,
  action: GateAction,
): GateActionResult {
  const model = buildReadModel(chain, action.at);
  const decision = model.decisions.find((candidate) => candidate.id === action.decisionId);
  if (!decision) {
    return { ok: false, code: "decision-not-found", message: "This decision is no longer pending." };
  }
  if (!actor.roles.includes(decision.role)) {
    return { ok: false, code: "not-authorized", message: "The signed-in identity does not hold this accountability." };
  }

  const item = chain.find((candidate) => candidate.id === decision.itemId)!;
  const currentRevision = artifactRevisionForGate(item, decision.gate);
  if (action.displayedRevision !== decision.revision || currentRevision !== action.displayedRevision) {
    return {
      ok: false,
      code: "stale-revision",
      currentRevision,
      message: "The artifact changed after this decision was rendered. Review the current revision.",
    };
  }
  if (action.kind === "send-back" && !action.note?.trim()) {
    return { ok: false, code: "note-required", message: "A send-back note is required." };
  }

  const updated: WorkItemChain = {
    ...item,
    artifacts: [...item.artifacts],
    signatures: [...item.signatures],
    decisionEvents: [...(item.decisionEvents ?? [])],
  };

  if (action.kind === "sign") {
    updated.signatures.push({
      gate: decision.gate,
      role: decision.role,
      revision: decision.revision,
      sequence: decision.sequencePosition,
      signedAt: action.at,
      signer: actor.displayName,
      subject: actor.subject,
    });
  } else {
    updated.decisionEvents!.push({
      action: "send-back",
      actorRole: decision.role,
      actorSubject: actor.subject,
      at: action.at,
      gate: decision.gate,
      note: action.note!.trim(),
      revision: decision.revision,
      routeTo: sendBackRoutes[decision.gate],
    });
  }

  return {
    ok: true,
    item: updated,
    chain: chain.map((candidate) => (candidate.id === updated.id ? updated : candidate)),
  };
}
