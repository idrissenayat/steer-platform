// @vitest-environment jsdom
import axe from "axe-core";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import App from "../src/App";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", window.location.pathname);
});

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

  it("runs organization setup as a conversation ending in one signed summary", async () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: /ask setup agent/i })[0]);
    const dialog = screen.getByRole("dialog", { name: /agent-first organization onboarding/i });
    expect(dialog.textContent).toContain("What are you building?");
    fireEvent.change(within(dialog).getByRole("textbox", { name: /your reply/i }), { target: { value: "A governed service for public-sector case teams" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /ask the setup questions/i }));
    expect(dialog.textContent).toContain("solo or with a team");
    fireEvent.click(within(dialog).getByRole("button", { name: /^regulated$/i }));
    fireEvent.click(within(dialog).getByRole("button", { name: /build the operating summary/i }));
    expect(dialog.textContent).toContain("two distinct humans");
    expect(dialog.textContent).toContain("7 explicit accountabilities");
    expect(dialog.textContent).toContain("7 independent agents");
    expect(dialog.textContent).toContain("humans only on deterministic escalation");
    expect(await seriousViolations(dialog)).toEqual([]);
    fireEvent.click(within(dialog).getByRole("button", { name: /sign once and start the loop/i }));
    expect(screen.getByRole("status").textContent).toContain("one signed operating summary");
    expect(container.textContent).toContain("regulated signer policy");
  });

  it("opens product-wide tagged terms as an in-place glossary peek", () => {
    render(<App />);
    const quickPeeks = screen.getByRole("region", { name: /glossary quick peeks/i });
    fireEvent.click(within(quickPeeks).getByRole("button", { name: "gate" }));
    expect(screen.getByRole("dialog", { name: /gate glossary entry/i }).textContent).toContain("three human signature points");
  });

  it("orders the role home as inbox, candidates, then ambient flight", () => {
    render(<App />);
    const inbox = screen.getByRole("heading", { name: "Decision inbox" });
    const candidates = screen.getByRole("heading", { name: "Intent backlog" });
    const flight = screen.getByRole("heading", { name: "Flight Board" });
    expect(inbox.compareDocumentPosition(candidates) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(candidates.compareDocumentPosition(flight) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Open full brief" }).length).toBeGreaterThan(0);
  });

  it("opens the full intent as a keyboard-contained, WIP-aware dialog", async () => {
    render(<App />);
    const intentCard = screen.getByRole("heading", { name: "Outcome contract telemetry" }).closest("article")!;
    const opener = within(intentCard).getByRole("button", { name: "Open full brief" });
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole("dialog", { name: /outcome contract telemetry intent detail/i });
    expect(window.location.hash).toBe("#intent-backlog/IN-014");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /close review/i }));
    expect((screen.getByRole("button", { name: /pull into flight · 5\/5 slots/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(dialog.querySelectorAll("[data-detail-section]").length).toBe(10);
    expect((screen.getByRole("button", { name: /decline with reason/i }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /preview merge/i }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: /send one question/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(await seriousViolations(dialog)).toEqual([]);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("deep-links to an expired recorded intent rather than an error", async () => {
    window.history.replaceState(null, "", "#intent-backlog/IN-009");
    render(<App />);
    const dialog = await screen.findByRole("dialog", { name: /daily progress digest intent detail/i });
    expect(dialog.textContent).toContain("Expired candidate");
    expect(dialog.textContent).toContain("A measurable success signal");
  });

  it("renders the Learn hub, section search, and one first-occurrence term link", async () => {
    window.history.replaceState(null, "", "#learn/framework/the-three-surfaces");
    const { container } = render(<App />);
    expect(await screen.findByRole("heading", { name: "Learn STEER" })).toBeTruthy();
    const section = document.getElementById("learn-framework-the-three-surfaces")!;
    expect(within(section).getAllByRole("button", { name: /intent.*open glossary definition/i })).toHaveLength(1);
    fireEvent.change(screen.getByRole("searchbox", { name: /search the operational canon/i }), { target: { value: "builders exam" } });
    const results = document.querySelector<HTMLElement>(".learn-search-results")!;
    expect(within(results).getByRole("button", { name: /eight plays/i })).toBeTruthy();
    expect(await seriousViolations(container)).toEqual([]);
  });

  it("opens one focus-managed glossary peek and returns focus on dismiss", async () => {
    window.history.replaceState(null, "", "#learn/framework/the-three-surfaces");
    render(<App />);
    await screen.findByRole("heading", { name: "Learn STEER" });
    const section = document.getElementById("learn-framework-the-three-surfaces")!;
    const term = within(section).getByRole("button", { name: /intent.*open glossary definition/i });
    term.focus();
    fireEvent.click(term);
    const dialog = screen.getByRole("dialog", { name: /intent glossary entry/i });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /close glossary entry/i }));
    expect(dialog.textContent).toContain("candidate brief in the intent backlog");
    expect(await seriousViolations(dialog)).toEqual([]);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: /intent glossary entry/i })).toBeNull();
    expect(document.activeElement).toBe(term);
  });

  it("files a governed change intent without editing Learn content", async () => {
    window.history.replaceState(null, "", "#learn/guidebook/overview");
    render(<App />);
    const button = await screen.findByRole("button", { name: /suggest a change to steer guidebook, overview/i });
    fireEvent.click(button);
    expect(screen.getByRole("status").textContent).toContain("was filed in the intent backlog");
    expect(screen.getByRole("status").textContent).toContain("was not edited in place");
  });

  it("shows a visible notice when a deep-linked Learn section was removed", async () => {
    window.history.replaceState(null, "", "#learn/framework/removed-section");
    render(<App />);
    expect((await screen.findByRole("status")).textContent).toContain("no longer in the current canon");
  });
});
