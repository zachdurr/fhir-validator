import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Command } from "commander";
import { validate } from "@fhir-validate/core";
import { formatText, formatJson } from "./formatters.js";

const program = new Command();

program
  .name("fhir-validate")
  .description("Validate FHIR R4 resources from JSON files")
  .version("0.1.0")
  .argument("<files...>", "FHIR JSON files to validate")
  .option("-f, --format <format>", "output format (text or json)", "text")
  .option("-s, --strict", "treat warnings as errors", false)
  .action(async (files: string[], opts: { format: string; strict: boolean }) => {
    let hasErrors = false;
    const jsonResults: object[] = [];

    for (const file of files) {
      const filePath = resolve(file);

      let content: string;
      try {
        content = await readFile(filePath, "utf-8");
      } catch {
        console.error(`Error: Could not read file '${file}'`);
        hasErrors = true;
        continue;
      }

      let resource: unknown;
      try {
        resource = JSON.parse(content);
      } catch {
        console.error(`Error: Invalid JSON in '${file}'`);
        hasErrors = true;
        continue;
      }

      const result = validate(resource);

      if (!result.valid) {
        hasErrors = true;
      }

      if (opts.strict && result.issues.some((i) => i.severity === "warning")) {
        hasErrors = true;
      }

      if (opts.format === "json") {
        jsonResults.push(formatJson(filePath, result));
      } else {
        console.log(formatText(filePath, result));
      }
    }

    if (opts.format === "json") {
      console.log(JSON.stringify(jsonResults, null, 2));
    }

    process.exit(hasErrors ? 1 : 0);
  });

program.parse();
