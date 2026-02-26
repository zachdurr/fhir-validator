import type { ValidationIssue, JsonPosition, FhirVersion } from "@fhir-validate/core";

export interface ResolvedIssue {
  issue: ValidationIssue;
  position: JsonPosition | undefined;
}

export interface FileResult {
  file: string;
  filePath: string;
  issues: ResolvedIssue[];
  parseError?: string;
  valid: boolean;
}

export interface CliOptions {
  format: "text" | "json" | "sarif";
  strict: boolean;
  severity: "error" | "warning" | "info";
  quiet: boolean;
  maxIssues: number;
  watch: boolean;
  stdin: boolean;
  fhirVersion: FhirVersion;
}

export const SEVERITY_RANK: Record<string, number> = {
  error: 0,
  warning: 1,
  info: 2,
};
