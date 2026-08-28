// @vitest-environment jsdom
import axe from "axe-core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import App from "../src/App";

afterEach(cleanup);

async function seriousViolations(container: HTMLElement) {
  const result = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
  return result.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious");
}

describe("automated accessibility gauntlet", () => {
  it("has no critical or serious structural violations on the workspace", async () => {
    const { container } = render(<App />);
    expect(await seriousViolations(container)).toEqual([]);
  });

  it("keeps the Gate review as a named modal with an explicit close control", async () => {
    render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: /review decision/i })[0]);
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-label")).toBeTruthy();
    expect(screen.getByRole("button", { name: /close review/i })).toBeTruthy();
    expect(await seriousViolations(dialog)).toEqual([]);
  });

  it("starts brief authoring as an interview without exposing a raw artifact", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /draft a brief/i }));
    expect(screen.getByText("Tell me what you know")).toBeTruthy();
    expect(screen.getByText("What short working title should we use?")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: /your answer/i })).toBeTruthy();
    expect(screen.queryByText(/# Brief:/)).toBeNull();
  });

  it("orders the role home as inbox, candidates, then ambient flight", () => {
    render(<App />);
    const inbox = screen.getByRole("heading", { name: "Decision inbox" });
    const candidates = screen.getByRole("heading", { name: "Intent backlog" });
    const flight = screen.getByRole("heading", { name: "Flight Board" });
    expect(inbox.compareDocumentPosition(candidates) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(candidates.compareDocumentPosition(flight) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Pull into flight" }).length).toBeGreaterThan(0);
  });
});
