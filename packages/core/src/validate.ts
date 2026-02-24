import type { ValidationResult, ValidateOptions, ValidationIssue } from "./types.js";

export function validate(
  resource: unknown,
  options: ValidateOptions = {}
): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (resource == null) {
    issues.push({
      severity: "error",
      path: "",
      message: "Resource is null or undefined",
      code: "INVALID_RESOURCE",
    });
    return { valid: false, issues };
  }

  if (Array.isArray(resource)) {
    issues.push({
      severity: "error",
      path: "",
      message: "Expected a FHIR resource object, got an array",
      code: "INVALID_RESOURCE",
    });
    return { valid: false, issues };
  }

  if (typeof resource !== "object") {
    issues.push({
      severity: "error",
      path: "",
      message: "Expected a FHIR resource object",
      code: "INVALID_RESOURCE",
    });
    return { valid: false, issues };
  }

  const res = resource as Record<string, unknown>;

  if (!("resourceType" in res)) {
    issues.push({
      severity: "error",
      path: "resourceType",
      message: "Missing required field 'resourceType'",
      code: "MISSING_RESOURCE_TYPE",
    });
    return { valid: false, issues };
  }

  if (typeof res.resourceType !== "string") {
    issues.push({
      severity: "error",
      path: "resourceType",
      message: "Field 'resourceType' must be a string",
      code: "INVALID_RESOURCE_TYPE",
    });
    return { valid: false, issues };
  }

  if (res.resourceType.trim() === "") {
    issues.push({
      severity: "error",
      path: "resourceType",
      message: "Field 'resourceType' must not be empty",
      code: "INVALID_RESOURCE_TYPE",
    });
    return { valid: false, issues };
  }

  return { valid: true, issues: [] };
}
