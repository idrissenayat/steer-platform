import { describe, expect, it } from "vitest";
import {
  appendInstrumentationEvent,
  computeBaselineSnapshot,
  detailEventToInstrumentation,
  firstLoginEvent,
  hubEventToInstrumentation,
  instrumentationSchemaVersion,
  validateInstrumentationEvent,
  type InstrumentationEvent,
} from "../src/domain/instrumentation";

const window = { start: "2026-08-01T00:00:00.000Z", end: "2026-08-14T23:59:59.999Z" };

function action(subjectId: string, sessionId: string, actionName: "pull" | "decline" | "merge" | "send-back", durationMs: number, surface: "detail_view" | "summary_card" = "summary_card"): InstrumentationEvent {
  return detailEventToInstrumentation({
    action: actionName,
    at: "2026-08-07T12:10:00.000Z",
    durationMs,
    intentId: `IN-${sessionId}`,
    revision: "abc123",
    sessionId,
    surface,
  }, subjectId);
}

describe("0002 instrumentation contract", () => {
  it("adapts detail and Learn events to one versioned content-free schema", () => {
    const backlogEvent = action("product-lead-1", "session-a", "pull", 1_200, "detail_view");
    const learnEvent = hubEventToInstrumentation({ at: "2026-08-07T12:05:00.000Z", durationMs: 300_000, page: "guidebook", section: "overview", type: "first-action" }, "product-lead-1", "session-a");
    expect(backlogEvent).toMatchObject({ action: "pull", schemaVersion: instrumentationSchemaVersion, surface: "detail_view", type: "backlog-action" });
    expect(learnEvent).toMatchObject({ page: "guidebook", surface: "learn_hub", type: "first-completed-action" });
    expect(validateInstrumentationEvent(backlogEvent)).toEqual({ errors: [], ok: true });
    expect(validateInstrumentationEvent(learnEvent)).toEqual({ errors: [], ok: true });
  });

  it("rejects artifact content, problem text, prompts, secrets, tokens, and schema drift", () => {
    const clean = action("product-lead-1", "session-a", "pull", 1_200);
    for (const forbidden of ["artifactContent", "problemText", "prompt", "secretValue", "accessToken"]) {
      expect(validateInstrumentationEvent({ ...clean, [forbidden]: "canary" })).toMatchObject({ ok: false, errors: expect.arrayContaining([expect.stringContaining("forbidden")]) });
    }
    expect(validateInstrumentationEvent({ ...clean, schemaVersion: "2.0.0" })).toMatchObject({ ok: false });
  });

  it("deduplicates events by event identity", () => {
    const event = action("product-lead-1", "session-a", "pull", 1_200);
    expect(appendInstrumentationEvent(appendInstrumentationEvent([], event), event)).toEqual([event]);
  });

  it("dry-runs both dependent baselines and distinguishes deliberate source opens", () => {
    const events: InstrumentationEvent[] = [
      action("a", "s1", "pull", 1_000, "detail_view"),
      action("b", "s2", "decline", 2_000, "summary_card"),
      action("c", "s3", "merge", 3_000, "detail_view"),
      action("d", "s4", "send-back", 8_000, "summary_card"),
      detailEventToInstrumentation({ action: "external-exit", at: "2026-08-07T12:02:00.000Z", durationMs: 500, intentId: "IN-s1", revision: "abc123", sessionId: "s1", surface: "detail_view" }, "a", "source-file"),
      detailEventToInstrumentation({ action: "external-exit", at: "2026-08-07T12:03:00.000Z", durationMs: 900, intentId: "IN-s2", revision: "abc123", sessionId: "s2", surface: "summary_card" }, "b", "other-external-tool"),
      firstLoginEvent("a", "login-a", "2026-08-07T10:00:00.000Z"),
      firstLoginEvent("b", "login-b", "2026-08-07T10:00:00.000Z"),
      hubEventToInstrumentation({ at: "2026-08-07T10:04:00.000Z", durationMs: 240_000, page: "guidebook", section: "overview", type: "first-action" }, "a", "login-a"),
      hubEventToInstrumentation({ at: "2026-08-07T10:10:00.000Z", durationMs: 600_000, page: "framework", section: "the-three-gates", type: "first-action" }, "b", "login-b"),
    ];
    expect(computeBaselineSnapshot(events, window, { actions: 4, subjects: 2 })).toEqual({
      backlog: {
        actionCount: 4,
        deliberateSourceExitShare: 0.25,
        detailViewActionShare: 0.5,
        externalExitShare: 0.5,
        medianOpenToActionMs: 2_500,
      },
      onboarding: { medianFirstLoginToActionMs: 420_000, subjectCount: 2 },
      schemaVersion: instrumentationSchemaVersion,
      status: "recorded",
      window,
    });
  });

  it("will not label an undersized fixture or partial production window as recorded", () => {
    const snapshot = computeBaselineSnapshot([action("a", "s1", "pull", 1_000)], window);
    expect(snapshot.status).toBe("insufficient-sample");
    expect(snapshot.backlog.actionCount).toBe(1);
    expect(snapshot.onboarding.subjectCount).toBe(0);
  });
});
