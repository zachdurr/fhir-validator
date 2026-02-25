import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  DefinitionLoader,
  StructureValidator,
  resolveJsonPosition,
} from "@fhir-validate/core";
import type { FileResult, ResolvedIssue } from "./types.js";
import { SEVERITY_RANK } from "./types.js";

let validator: StructureValidator | undefined;

function getValidator(): StructureValidator {
  if (!validator) {
    const loader = new DefinitionLoader();
    validator = new StructureValidator(loader);
  }
  return validator;
}

/** @internal Test-only: override the singleton validator */
export function _setValidator(v: StructureValidator): void {
  validator = v;
}

export async function validateFile(
  file: string,
  minSeverity: string = "info",
  maxIssues: number = 0,
): Promise<FileResult> {
  const filePath = resolve(file);

  let content: string;
  try {
    content = await readFile(filePath, "utf-8");
  } catch {
    return {
      file,
      filePath,
      issues: [],
      parseError: `Could not read file '${file}'`,
      valid: false,
    };
  }

  return processContent(content, file, filePath, minSeverity, maxIssues);
}

export async function validateStdin(
  minSeverity: string = "info",
  maxIssues: number = 0,
): Promise<FileResult> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  const content = Buffer.concat(chunks).toString("utf-8");

  return processContent(content, "<stdin>", "<stdin>", minSeverity, maxIssues);
}

function processContent(
  content: string,
  file: string,
  filePath: string,
  minSeverity: string,
  maxIssues: number,
): FileResult {
  let resource: unknown;
  try {
    resource = JSON.parse(content);
  } catch {
    return {
      file,
      filePath,
      issues: [],
      parseError: `Invalid JSON in '${file}'`,
      valid: false,
    };
  }

  let result;
  try {
    result = getValidator().validate(resource);
  } catch {
    return {
      file,
      filePath,
      issues: [],
      parseError: `No FHIR definitions available. Ensure @fhir-validate/core includes definitions.`,
      valid: false,
    };
  }

  const minRank = SEVERITY_RANK[minSeverity] ?? 2;
  const filtered = result.issues.filter(
    (issue) => (SEVERITY_RANK[issue.severity] ?? 2) <= minRank,
  );

  const limited = maxIssues > 0 ? filtered.slice(0, maxIssues) : filtered;

  const issues: ResolvedIssue[] = limited.map((issue) => ({
    issue,
    position: resolveJsonPosition(content, issue.path),
  }));

  const hasErrors = issues.some((i) => i.issue.severity === "error");

  return {
    file,
    filePath,
    issues,
    valid: !hasErrors && !result.issues.some((i) => i.severity === "error"),
  };
}
