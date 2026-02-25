import { describe, it, expect } from "vitest";
import { formatJson } from "../../formatters/json.js";
import type { FileResult, ResolvedIssue } from "../../types.js";

function makeResult(overrides: Partial<FileResult> = {}): FileResult {
  return {
    file: "test.fhir.json",
    filePath: "/path/to/test.fhir.json",
    issues: [],
    valid: true,
    ...overrides,
  };
}

describe("formatJson", () => {
  it("returns valid JSON array string", () => {
    const result = makeResult();
    const output = formatJson([result]);
    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
  });

  it("includes file and valid fields", () => {
    const result = makeResult({ valid: true });
    const parsed = JSON.parse(formatJson([result]));
    expect(parsed[0].file).toBe("test.fhir.json");
    expect(parsed[0].valid).toBe(true);
  });

  it("uses 1-based positions", () => {
    const issue: ResolvedIssue = {
      issue: {
        severity: "error",
        path: "Patient.id",
        message: "Bad id",
        code: "INVALID_TYPE",
      },
      position: { line: 2, startChar: 5, endChar: 10 },
    };
    const result = makeResult({ valid: false, issues: [issue] });
    const parsed = JSON.parse(formatJson([result]));
    // 0-based line 2 → 1-based line 3
    expect(parsed[0].issues[0].line).toBe(3);
    // 0-based col 5 → 1-based col 6
    expect(parsed[0].issues[0].column).toBe(6);
  });

  it("includes 0 for missing positions", () => {
    const issue: ResolvedIssue = {
      issue: {
        severity: "error",
        path: "Patient.missing",
        message: "Required",
        code: "REQUIRED_FIELD",
      },
      position: undefined,
    };
    const result = makeResult({ valid: false, issues: [issue] });
    const parsed = JSON.parse(formatJson([result]));
    expect(parsed[0].issues[0].line).toBe(0);
    expect(parsed[0].issues[0].column).toBe(0);
  });

  it("includes optional details and url", () => {
    const issue: ResolvedIssue = {
      issue: {
        severity: "warning",
        path: "Patient.foo",
        message: "Unknown",
        code: "UNKNOWN_PROPERTY",
        details: "Some detail",
        url: "https://hl7.org/fhir",
      },
      position: { line: 0, startChar: 0, endChar: 5 },
    };
    const result = makeResult({ issues: [issue] });
    const parsed = JSON.parse(formatJson([result]));
    expect(parsed[0].issues[0].details).toBe("Some detail");
    expect(parsed[0].issues[0].url).toBe("https://hl7.org/fhir");
  });

  it("omits details and url when not present", () => {
    const issue: ResolvedIssue = {
      issue: {
        severity: "error",
        path: "Patient.id",
        message: "Bad",
        code: "E1",
      },
      position: { line: 0, startChar: 0, endChar: 1 },
    };
    const result = makeResult({ valid: false, issues: [issue] });
    const parsed = JSON.parse(formatJson([result]));
    expect(parsed[0].issues[0].details).toBeUndefined();
    expect(parsed[0].issues[0].url).toBeUndefined();
  });

  it("includes parseError when present", () => {
    const result = makeResult({ valid: false, parseError: "Invalid JSON" });
    const parsed = JSON.parse(formatJson([result]));
    expect(parsed[0].parseError).toBe("Invalid JSON");
  });

  it("handles multiple files", () => {
    const results: FileResult[] = [
      makeResult({ file: "a.json", valid: true }),
      makeResult({ file: "b.json", valid: false }),
    ];
    const parsed = JSON.parse(formatJson(results));
    expect(parsed).toHaveLength(2);
    expect(parsed[0].file).toBe("a.json");
    expect(parsed[1].file).toBe("b.json");
  });
});
