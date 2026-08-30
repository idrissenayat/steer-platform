import type { DetailActionEvent } from "./intent-detail";
import type { HubEvent } from "./learn";

export const instrumentationSchemaVersion = "1.0.0" as const;

export type InstrumentationSurface = "detail_view" | "summary_card" | "learn_hub";

interface InstrumentationEnvelope {
  at: string;
  eventId: string;
  schemaVersion: typeof instrumentationSchemaVersion;
  sessionId: string;
  subjectId: string;
}

export type InstrumentationEvent =
  | (InstrumentationEnvelope & {
      action: "pull" | "decline" | "merge" | "send-back";
      durationMs: number;
      intentId: string;
      revision: string;
      surface: "detail_view" | "summary_card";
      type: "backlog-action";
    })
  | (InstrumentationEnvelope & {
      durationMs: number;
      exitKind: "source-file" | "other-external-tool";
      intentId: string;
      revision: string;
      surface: "detail_view" | "summary_card";
      type: "external-exit";
    })
  | (InstrumentationEnvelope & {
      type: "first-login";
    })
  | (InstrumentationEnvelope & {
      durationMs: number;
      page: string;
      section: string;
      surface: "learn_hub";
      type: "first-completed-action";
    })
  | (InstrumentationEnvelope & {
      durationMs: number;
      page: string;
      section: string;
      surface: "learn_hub";
      type: "learn-navigation";
    });

export interface BaselineWindow {
  end: string;
  start: string;
}

export interface BacklogBaseline {
  actionCount: number;
  deliberateSourceExitShare: number;
  detailViewActionShare: number;
  externalExitShare: number;
  medianOpenToActionMs: number;
}

export interface OnboardingBaseline {
  medianFirstLoginToActionMs: number;
  subjectCount: number;
}

export interface BaselineSnapshot {
  backlog: BacklogBaseline;
  onboarding: OnboardingBaseline;
  schemaVersion: typeof instrumentationSchemaVersion;
  status: "insufficient-sample" | "recorded";
  window: BaselineWindow;
}

const allowedKeys: Record<InstrumentationEvent["type"], Set<string>> = {
  "backlog-action": new Set(["action", "at", "durationMs", "eventId", "intentId", "revision", "schemaVersion", "sessionId", "subjectId", "surface", "type"]),
  "external-exit": new Set(["at", "durationMs", "eventId", "exitKind", "intentId", "revision", "schemaVersion", "sessionId", "subjectId", "surface", "type"]),
  "first-completed-action": new Set(["at", "durationMs", "eventId", "page", "schemaVersion", "section", "sessionId", "subjectId", "surface", "type"]),
  "first-login": new Set(["at", "eventId", "schemaVersion", "sessionId", "subjectId", "type"]),
  "learn-navigation": new Set(["at", "durationMs", "eventId", "page", "schemaVersion", "section", "sessionId", "subjectId", "surface", "type"]),
};

const forbiddenKeyFragments = ["artifact", "content", "problem", "prompt", "secret", "token"];

function median(values: number[]): number {
  if (!values.length) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

function inWindow(at: string, window: BaselineWindow): boolean {
  const value = new Date(at).getTime();
  return Number.isFinite(value) && value >= new Date(window.start).getTime() && value <= new Date(window.end).getTime();
}

export function validateInstrumentationEvent(value: unknown): { errors: string[]; ok: boolean } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { errors: ["Event must be an object."], ok: false };
  const event = value as Record<string, unknown>;
  const errors: string[] = [];
  const type = event.type;
  if (typeof type !== "string" || !(type in allowedKeys)) errors.push("Event type is not part of the instrumentation contract.");
  if (event.schemaVersion !== instrumentationSchemaVersion) errors.push(`schemaVersion must be ${instrumentationSchemaVersion}.`);
  for (const key of Object.keys(event)) {
    if (forbiddenKeyFragments.some((fragment) => key.toLowerCase().includes(fragment))) errors.push(`${key} is forbidden by the privacy contract.`);
    if (typeof type === "string" && type in allowedKeys && !allowedKeys[type as InstrumentationEvent["type"]].has(key)) errors.push(`${key} is not allowed for ${type}.`);
  }
  for (const key of ["at", "eventId", "sessionId", "subjectId"]) {
    if (typeof event[key] !== "string" || !event[key]) errors.push(`${key} is required.`);
  }
  if (typeof event.at === "string" && !Number.isFinite(new Date(event.at).getTime())) errors.push("at must be an ISO-compatible timestamp.");
  if ("durationMs" in event && (typeof event.durationMs !== "number" || event.durationMs < 0)) errors.push("durationMs must be a non-negative number.");
  return { errors: [...new Set(errors)], ok: errors.length === 0 };
}

export function detailEventToInstrumentation(event: DetailActionEvent, subjectId: string, exitKind: "source-file" | "other-external-tool" = "source-file"): InstrumentationEvent {
  const common = {
    at: event.at,
    durationMs: event.durationMs,
    eventId: `${event.sessionId}:${event.intentId}:${event.action}`,
    intentId: event.intentId,
    revision: event.revision,
    schemaVersion: instrumentationSchemaVersion,
    sessionId: event.sessionId,
    subjectId,
    surface: event.surface,
  } as const;
  return event.action === "external-exit"
    ? { ...common, exitKind, type: "external-exit" }
    : { ...common, action: event.action, type: "backlog-action" };
}

export function firstLoginEvent(subjectId: string, sessionId: string, at: string): InstrumentationEvent {
  return { at, eventId: `${sessionId}:first-login`, schemaVersion: instrumentationSchemaVersion, sessionId, subjectId, type: "first-login" };
}

export function hubEventToInstrumentation(event: HubEvent, subjectId: string, sessionId: string): InstrumentationEvent {
  const common = {
    at: event.at,
    durationMs: event.durationMs,
    eventId: `${sessionId}:${event.type}:${event.page}:${event.section}`,
    page: event.page,
    schemaVersion: instrumentationSchemaVersion,
    section: event.section,
    sessionId,
    subjectId,
    surface: "learn_hub" as const,
  };
  return event.type === "first-action"
    ? { ...common, type: "first-completed-action" }
    : { ...common, type: "learn-navigation" };
}

export function appendInstrumentationEvent(events: InstrumentationEvent[], event: InstrumentationEvent): InstrumentationEvent[] {
  if (events.some((candidate) => candidate.eventId === event.eventId)) return events;
  const validation = validateInstrumentationEvent(event);
  if (!validation.ok) throw new Error(validation.errors.join(" "));
  return [...events, event];
}

export function computeBaselineSnapshot(
  events: InstrumentationEvent[],
  window: BaselineWindow,
  minimums: { actions: number; subjects: number } = { actions: 20, subjects: 5 },
): BaselineSnapshot {
  const scoped = events.filter((event) => inWindow(event.at, window));
  const actions = scoped.filter((event): event is Extract<InstrumentationEvent, { type: "backlog-action" }> => event.type === "backlog-action");
  const exits = scoped.filter((event): event is Extract<InstrumentationEvent, { type: "external-exit" }> => event.type === "external-exit");
  const sessionsWithExit = new Set(exits.map((event) => event.sessionId));
  const sessionsWithSourceExit = new Set(exits.filter((event) => event.exitKind === "source-file").map((event) => event.sessionId));
  const firstLogins = new Map<string, number>();
  for (const event of scoped) {
    if (event.type !== "first-login") continue;
    const timestamp = new Date(event.at).getTime();
    firstLogins.set(event.subjectId, Math.min(firstLogins.get(event.subjectId) ?? timestamp, timestamp));
  }
  const firstActionDurations = new Map<string, number>();
  for (const event of scoped) {
    if (event.type !== "first-completed-action") continue;
    const login = firstLogins.get(event.subjectId);
    if (login === undefined) continue;
    const duration = new Date(event.at).getTime() - login;
    if (duration < 0) continue;
    firstActionDurations.set(event.subjectId, Math.min(firstActionDurations.get(event.subjectId) ?? duration, duration));
  }
  const share = (count: number) => actions.length ? count / actions.length : 0;
  const onboardingDurations = [...firstActionDurations.values()];
  return {
    backlog: {
      actionCount: actions.length,
      deliberateSourceExitShare: share(actions.filter((event) => sessionsWithSourceExit.has(event.sessionId)).length),
      detailViewActionShare: share(actions.filter((event) => event.surface === "detail_view").length),
      externalExitShare: share(actions.filter((event) => sessionsWithExit.has(event.sessionId)).length),
      medianOpenToActionMs: median(actions.map((event) => event.durationMs)),
    },
    onboarding: {
      medianFirstLoginToActionMs: median(onboardingDurations),
      subjectCount: onboardingDurations.length,
    },
    schemaVersion: instrumentationSchemaVersion,
    status: actions.length >= minimums.actions && onboardingDurations.length >= minimums.subjects ? "recorded" : "insufficient-sample",
    window,
  };
}
