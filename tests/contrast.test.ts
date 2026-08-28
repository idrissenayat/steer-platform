import { describe, expect, it } from "vitest";

function luminance(hex: string): number {
  const channels = hex.slice(1).match(/../g)!.map((part) => parseInt(part, 16) / 255).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
function contrast(left: string, right: string): number {
  const [bright, dark] = [luminance(left), luminance(right)].sort((a, b) => b - a);
  return (bright + 0.05) / (dark + 0.05);
}

describe("cotton-candy accessible palette", () => {
  it.each([
    ["primary text", "#4b2038", "#fff8f4"],
    ["muted text", "#806b76", "#fffdfb"],
    ["raspberry label", "#a34b6c", "#fffdfb"],
    ["pink action", "#4b2038", "#e97595"],
    ["orange action", "#4b2038", "#f1a36f"],
  ])("keeps %s above WCAG AA", (_name, foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });
});
