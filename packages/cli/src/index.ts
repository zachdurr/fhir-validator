import { Command, InvalidArgumentError } from "commander";
import fg from "fast-glob";
import type { FhirVersion } from "@fhir-validate/core";
import { validateFile, validateStdin } from "./validate.js";
import { formatText, formatJson, formatSarif } from "./formatters/index.js";
import { startWatch } from "./watch.js";
import { SEVERITY_RANK } from "./types.js";
import type { CliOptions, FileResult } from "./types.js";

const VALID_FHIR_VERSIONS = ["R4", "R5"];

const program = new Command();

program
  .name("fhir-validate")
  .description("Validate FHIR resources from JSON files")
  .version("0.1.0")
  .argument("[files...]", "FHIR JSON files or glob patterns to validate")
  .option("-f, --format <format>", "output format (text, json, sarif)", "text")
  .option("-s, --strict", "treat warnings as errors", false)
  .option("--severity <level>", "minimum severity to report (error, warning, info)", "info")
  .option("--quiet", "suppress summary line", false)
  .option(
    "--max-issues <n>",
    "max issues per file (0 = unlimited)",
    (v) => {
      const n = parseInt(v, 10);
      if (isNaN(n) || n < 0) throw new InvalidArgumentError("Must be a non-negative integer.");
      return n;
    },
    0,
  )
  .option("--stdin", "read JSON from stdin", false)
  .option("-w, --watch", "watch files for changes", false)
  .option("--fhir-version <version>", "FHIR version to validate against (R4, R5)", "R4")
  .action(async (files: string[], opts: Record<string, unknown>) => {
    const options: CliOptions = {
      format: opts.format as CliOptions["format"],
      strict: opts.strict as boolean,
      severity: opts.severity as CliOptions["severity"],
      quiet: opts.quiet as boolean,
      maxIssues: opts.maxIssues as number,
      watch: opts.watch as boolean,
      stdin: opts.stdin as boolean,
      fhirVersion: opts.fhirVersion as FhirVersion,
    };

    // Validate format
    if (!["text", "json", "sarif"].includes(options.format)) {
      console.error(`Error: Invalid format '${options.format}'. Use text, json, or sarif.`);
      process.exit(2);
    }

    // Validate severity
    if (!(options.severity in SEVERITY_RANK)) {
      console.error(`Error: Invalid severity '${options.severity}'. Use error, warning, or info.`);
      process.exit(2);
    }

    // Validate FHIR version
    if (!VALID_FHIR_VERSIONS.includes(options.fhirVersion)) {
      console.error(
        `Error: Invalid FHIR version '${options.fhirVersion}'. Use ${VALID_FHIR_VERSIONS.join(" or ")}.`,
      );
      process.exit(2);
    }

    // Must have files or --stdin
    if (!options.stdin && files.length === 0) {
      console.error("Error: No files specified. Provide file paths/globs or use --stdin.");
      process.exit(2);
    }

    // Stdin mode
    if (options.stdin) {
      const result = await validateStdin(options.severity, options.maxIssues, options.fhirVersion);
      outputResults([result], options);
      return;
    }

    // Watch mode
    if (options.watch) {
      startWatch(files, options);
      return;
    }

    // Expand globs
    const expanded = await fg(files, { dot: false, onlyFiles: true });
    if (expanded.length === 0) {
      console.error("Error: No files matched the given patterns.");
      process.exit(2);
    }

    // Validate all files
    const results: FileResult[] = [];
    for (const file of expanded.sort()) {
      results.push(
        await validateFile(file, options.severity, options.maxIssues, options.fhirVersion),
      );
    }

    outputResults(results, options);
  });

function outputResults(results: FileResult[], options: CliOptions): void {
  let output: string;

  switch (options.format) {
    case "json":
      output = formatJson(results);
      break;
    case "sarif":
      output = formatSarif(results);
      break;
    default:
      output = formatText(results, options.quiet);
      break;
  }

  if (output.trim()) {
    console.log(output);
  }

  // Determine exit code
  const hasErrors = results.some((r) => !r.valid || r.parseError);
  const hasWarnings = results.some((r) => r.issues.some((i) => i.issue.severity === "warning"));

  if (hasErrors) {
    process.exit(1);
  }
  if (options.strict && hasWarnings) {
    process.exit(1);
  }
}

program.parse();
