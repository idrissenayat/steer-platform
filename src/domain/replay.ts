import type { ProjectionEvent, WorkItemChain } from "./types";

export function replayEvents(events: ProjectionEvent[]): WorkItemChain[] {
  const latest = new Map<string, WorkItemChain>();
  for (const event of [...events].sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id))) {
    latest.set(event.item.id, structuredClone(event.item));
  }
  return [...latest.values()].sort((left, right) => left.id.localeCompare(right.id));
}

export function reconcileProjection(
  events: ProjectionEvent[],
  authoritativeItems: WorkItemChain[],
  at: string,
): ProjectionEvent[] {
  const nextSequence = Math.max(0, ...events.map((event) => event.sequence)) + 1;
  const current = new Map(replayEvents(events).map((item) => [item.id, JSON.stringify(item)]));
  const repairs = authoritativeItems
    .filter((item) => current.get(item.id) !== JSON.stringify(item))
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((item, index) => ({
      id: `reconcile-${nextSequence + index}-${item.id}`,
      item: structuredClone(item),
      occurredAt: at,
      sequence: nextSequence + index,
    }));
  return [...events, ...repairs];
}
