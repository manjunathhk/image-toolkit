const colors: Record<string, number> = {
  DONE: 32,
  SKIP: 33,
  FAIL: 31,
  PLAN: 36,
};

export function formatOutput(text: string, color: boolean): string {
  if (!color) return text;
  return text
    .split("\n")
    .map((line) => {
      const status = /^(DONE|SKIP|FAIL|PLAN)\b/.exec(line)?.[0];
      if (status)
        return `\x1b[${colors[status]}m${status}\x1b[0m${line.slice(status.length)}`;
      if (line.startsWith("========== SUMMARY"))
        return `\x1b[1;36m${line}\x1b[0m`;
      const label =
        /^(Converted|Skipped|Failed|Original|Savings|Duration)(?=\s*:)/.exec(
          line,
        )?.[0];
      if (label) return `\x1b[1m${label}\x1b[0m${line.slice(label.length)}`;
      return line;
    })
    .join("\n");
}

export function logOutput(line: string): void {
  const color =
    process.env.NO_COLOR === undefined &&
    !!process.stdout.isTTY &&
    process.stdout.hasColors();
  console.log(formatOutput(line, color));
}
