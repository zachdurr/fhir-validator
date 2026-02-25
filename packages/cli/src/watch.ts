import { watch as chokidarWatch } from "chokidar";
import { validateFile } from "./validate.js";
import { formatText } from "./formatters/index.js";
import type { CliOptions } from "./types.js";

export function startWatch(patterns: string[], options: CliOptions): void {
  const watcher = chokidarWatch(patterns, {
    persistent: true,
    ignoreInitial: false,
  });

  async function handleFile(filePath: string): Promise<void> {
    const result = await validateFile(filePath, options.severity, options.maxIssues);
    const output = formatText([result], options.quiet);
    if (output.trim()) {
      // Clear line and print fresh
      console.log(`\n${output}`);
    }
  }

  watcher.on("add", handleFile);
  watcher.on("change", handleFile);

  // Graceful shutdown
  process.on("SIGINT", () => {
    watcher.close().then(() => process.exit(0));
  });

  process.on("SIGTERM", () => {
    watcher.close().then(() => process.exit(0));
  });
}
