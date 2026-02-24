import type { ValidationResult } from "@fhir-validate/core";

export function formatText(
  filePath: string,
  result: ValidationResult
): string {
  const lines: string[] = [];

  if (result.valid) {
    lines.push(`✓ ${filePath}: valid`);
  } else {
    lines.push(`✗ ${filePath}: invalid`);
  }

  for (const issue of result.issues) {
    const prefix =
      issue.severity === "error"
        ? "  ERROR"
        : issue.severity === "warning"
          ? "  WARN "
          : "  INFO ";
    const path = issue.path ? ` (${issue.path})` : "";
    lines.push(`${prefix}${path}: ${issue.message}`);
  }

  return lines.join("\n");
}

export function formatJson(
  filePath: string,
  result: ValidationResult
): object {
  return {
    file: filePath,
    valid: result.valid,
    issues: result.issues,
  };
}
