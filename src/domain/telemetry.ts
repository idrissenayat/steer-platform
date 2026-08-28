export type PilotTelemetryEvent =
  | { type: "decision-ready"; decisionId: string; at: string }
  | { type: "decision-opened"; decisionId: string; at: string }
  | { type: "decision-completed"; decisionId: string; at: string; stayedInPlatform: boolean; humanSeconds: number }
  | { type: "item-shipped"; itemId: string; at: string; humanSeconds: number };

export interface PilotMetrics {
  medianGateWaitHours: number;
  centralizationPercent: number;
  humanHoursPerShippedItem: number;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

export function summarizePilot(events: PilotTelemetryEvent[]): PilotMetrics {
  const ready = new Map(
    events.filter((event): event is Extract<PilotTelemetryEvent, { type: "decision-ready" }> => event.type === "decision-ready")
      .map((event) => [event.decisionId, event.at]),
  );
  const completed = events.filter(
    (event): event is Extract<PilotTelemetryEvent, { type: "decision-completed" }> => event.type === "decision-completed",
  );
  const waits = completed.flatMap((event) => {
    const start = ready.get(event.decisionId);
    return start ? [(new Date(event.at).getTime() - new Date(start).getTime()) / 3_600_000] : [];
  });
  const shipped = events.filter(
    (event): event is Extract<PilotTelemetryEvent, { type: "item-shipped" }> => event.type === "item-shipped",
  );

  return {
    medianGateWaitHours: Math.round(median(waits) * 10) / 10,
    centralizationPercent: completed.length
      ? Math.round((completed.filter((event) => event.stayedInPlatform).length / completed.length) * 100)
      : 0,
    humanHoursPerShippedItem: shipped.length
      ? Math.round((shipped.reduce((sum, event) => sum + event.humanSeconds, 0) / shipped.length / 3600) * 100) / 100
      : 0,
  };
}
