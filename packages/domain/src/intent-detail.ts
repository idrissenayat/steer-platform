import { pullDisposition, type ProjectedIntent } from "./intent-backlog";

export type DetailAction = "pull" | "decline" | "merge" | "send-back";

export interface DetailActionEvent {
  action: DetailAction | "external-exit";
  at: string;
  durationMs: number;
  intentId: string;
  members?: string[];
  question?: string;
  reason?: string;
  revision: string;
  sessionId: string;
  surface: "detail_view" | "summary_card";
}

export interface DetailActionInput {
  action: DetailAction;
  at: string;
  currentRevision: string;
  displayedRevision: string;
  durationMs: number;
  inFlightCount: number;
  intent: ProjectedIntent;
  members?: string[];
  question?: string;
  reason?: string;
  sessionId: string;
  wipLimit: number;
}

export type DetailActionResult =
  | { currentRevision: string; message: string; ok: false; reason: "stale" | "wip" | "validation" }
  | { event: DetailActionEvent; ok: true };

export function performDetailAction(input: DetailActionInput): DetailActionResult {
  if (input.displayedRevision !== input.currentRevision) {
    return { currentRevision: input.currentRevision, message: "This intent changed while it was open. The action was not applied and the current version is now shown.", ok: false, reason: "stale" };
  }
  if (input.action === "pull") {
    const disposition = pullDisposition(input.inFlightCount, input.wipLimit);
    if (!disposition.allowed) return { currentRevision: input.currentRevision, message: disposition.message, ok: false, reason: "wip" };
  }
  if (input.action === "decline" && !input.reason?.trim()) {
    return { currentRevision: input.currentRevision, message: "A decline reason is required.", ok: false, reason: "validation" };
  }
  if (input.action === "merge" && !input.members?.length) {
    return { currentRevision: input.currentRevision, message: "Choose at least one cluster member to merge.", ok: false, reason: "validation" };
  }
  if (input.action === "send-back" && !input.question?.trim()) {
    return { currentRevision: input.currentRevision, message: "Enter one question for the originator.", ok: false, reason: "validation" };
  }

  return {
    ok: true,
    event: {
      action: input.action,
      at: input.at,
      durationMs: input.durationMs,
      intentId: input.intent.id,
      ...(input.members ? { members: input.members } : {}),
      ...(input.question?.trim() ? { question: input.question.trim() } : {}),
      ...(input.reason?.trim() ? { reason: input.reason.trim() } : {}),
      revision: input.currentRevision,
      sessionId: input.sessionId,
      surface: "detail_view",
    },
  };
}

export function previewMergedIntent(primary: ProjectedIntent, members: ProjectedIntent[]) {
  return {
    memberIds: members.map((member) => member.id),
    outcome: primary.outcome,
    problem: primary.problem,
    title: primary.title,
  };
}

export function orderedDetailSections(intent: ProjectedIntent): string[] {
  return [
    "problem",
    "outcome",
    "outcome-contract",
    ...(intent.constraints?.length ? ["constraints"] : []),
    "domains",
    ...(intent.affectedUsers?.length || intent.systems?.length ? ["affected-users-systems"] : []),
    ...(intent.openQuestions?.length ? ["open-questions"] : []),
    "provenance",
    ...(intent.clusterMemberIds?.length ? ["cluster-members"] : []),
    ...(intent.revisionHistory?.length ? ["revision-history"] : []),
  ];
}

export function recordExternalExit(events: DetailActionEvent[], input: Omit<DetailActionEvent, "action" | "surface">): DetailActionEvent[] {
  if (events.some((event) => event.action === "external-exit" && event.intentId === input.intentId && event.sessionId === input.sessionId)) return events;
  return [...events, { ...input, action: "external-exit", surface: "detail_view" }];
}

export function summarizeDetailOutcome(events: DetailActionEvent[]) {
  const actions = events.filter((event) => event.action !== "external-exit");
  const detailActions = actions.filter((event) => event.surface === "detail_view");
  const allResolved = detailActions.map((event) => event.durationMs).sort((a, b) => a - b);
  const midpoint = Math.floor(allResolved.length / 2);
  const medianDurationMs = allResolved.length === 0 ? 0 : allResolved.length % 2 ? allResolved[midpoint]! : (allResolved[midpoint - 1]! + allResolved[midpoint]!) / 2;
  return {
    detailViewShare: actions.length ? detailActions.length / actions.length : 0,
    medianDurationMs,
  };
}
