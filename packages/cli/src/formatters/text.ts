import chalk from "chalk";
import type { FileResult } from "../types.js";

export function formatText(results: FileResult[], quiet: boolean): string {
  const lines: string[] = [];
  let totalErrors = 0;
  let totalWarnings = 0;
  let totalInfos = 0;

  for (const result of results) {
    if (result.parseError) {
      lines.push(chalk.underline(result.file));
      lines.push(`  ${chalk.red("error")}  ${result.parseError}`);
      lines.push("");
      totalErrors++;
      continue;
    }

    if (result.issues.length === 0) {
      continue;
    }

    lines.push(chalk.underline(result.file));

    for (const { issue, position } of result.issues) {
      // 1-based positions for display (JsonPosition is 0-based)
      const line = position ? position.line + 1 : 0;
      const col = position ? position.startChar + 1 : 0;
      const loc = chalk.dim(`${line}:${col}`);

      let severity: string;
      if (issue.severity === "error") {
        severity = chalk.red("error");
        totalErrors++;
      } else if (issue.severity === "warning") {
        severity = chalk.yellow("warning");
        totalWarnings++;
      } else {
        severity = chalk.blue("info");
        totalInfos++;
      }

      const code = chalk.dim(issue.code);
      lines.push(`  ${loc}  ${severity}  ${issue.message}  ${code}`);
    }

    lines.push("");
  }

  if (!quiet) {
    const total = totalErrors + totalWarnings + totalInfos;
    if (total > 0) {
      const parts: string[] = [];
      if (totalErrors > 0) parts.push(chalk.red(`${totalErrors} error${totalErrors !== 1 ? "s" : ""}`));
      if (totalWarnings > 0) parts.push(chalk.yellow(`${totalWarnings} warning${totalWarnings !== 1 ? "s" : ""}`));
      if (totalInfos > 0) parts.push(chalk.blue(`${totalInfos} info`));

      const icon = totalErrors > 0 ? chalk.red("\u2716") : chalk.yellow("\u26A0");
      lines.push(`${icon} ${total} problem${total !== 1 ? "s" : ""} (${parts.join(", ")})`);
    }
  }

  return lines.join("\n");
}
