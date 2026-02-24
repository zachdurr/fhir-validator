import { describe, it, expect } from "vitest";
import { formatText, formatJson } from "../formatters.js";
import type { ValidationResult } from "@fhir-validate/core";

describe("formatText", () => {
  it("formats valid result", () => {
    const result: ValidationResult = { valid: true, issues: [] };
    const output = formatText("test.json", result);
    expect(output).toContain("✓");
    expect(output).toContain("test.json");
    expect(output).toContain("valid");
  });

  it("formats invalid result with issues", () => {
    const result: ValidationResult = {
      valid: false,
      issues: [
        {
          severity: "error",
          path: "resourceType",
          message: "Missing required field",
          code: "MISSING_RESOURCE_TYPE",
        },
      ],
    };
    const output = formatText("bad.json", result);
    expect(output).toContain("✗");
    expect(output).toContain("bad.json");
    expect(output).toContain("ERROR");
    expect(output).toContain("Missing required field");
  });
});

describe("formatJson", () => {
  it("returns structured output", () => {
    const result: ValidationResult = { valid: true, issues: [] };
    const output = formatJson("test.json", result) as Record<string, unknown>;
    expect(output.file).toBe("test.json");
    expect(output.valid).toBe(true);
    expect(output.issues).toEqual([]);
  });
});
