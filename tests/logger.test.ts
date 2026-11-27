import { expect, it } from "vitest";
import { formatOutput } from "../src/logger.js";

it("colors status labels without changing filenames or messages", () => {
  for (const [status, code] of [
    ["DONE", 32],
    ["SKIP", 33],
    ["FAIL", 31],
    ["PLAN", 36],
  ]) {
    expect(formatOutput(`${status}  photo.png | message`, true)).toBe(
      `\x1b[${code}m${status}\x1b[0m  photo.png | message`,
    );
  }
});

it("keeps redirected output plain and emphasizes terminal summaries", () => {
  const summary = "========== SUMMARY ==========\nConverted : 1\nFailed    : 0";
  expect(formatOutput(summary, false)).toBe(summary);
  expect(formatOutput("DONE  photo.png", false)).toBe("DONE  photo.png");
  expect(formatOutput(summary, true)).toContain("\x1b[1;36m========== SUMMARY");
  expect(formatOutput(summary, true)).toContain("\x1b[1mFailed\x1b[0m    : 0");
});
