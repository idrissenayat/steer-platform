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

  it("exposes the scope check in guided brief authoring", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /draft a brief/i }));
    expect(screen.getByText("Scope check")).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: /one crisp/i })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: /one coherent shape/i })).toBeTruthy();
  });
});
