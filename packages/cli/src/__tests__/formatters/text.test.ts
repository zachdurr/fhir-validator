import { describe, it, expect } from "vitest";
import { formatText } from "../../formatters/text.js";
import type { FileResult, ResolvedIssue } from "../../types.js";

function makeIssue(
  severity: "error" | "warning" | "info",
  path: string,
  message: string,
  code: string,
  line: number,
  startChar: number,
  endChar: number,
): ResolvedIssue {
  return {
    issue: { severity, path, message, code },
    position: { line, startChar, endChar },
  };
}

function makeResult(overrides: Partial<FileResult> = {}): FileResult {
  return {
    file: "test.fhir.json",
    filePath: "/path/to/test.fhir.json",
    issues: [],
    valid: true,
    ...overrides,
  };
}

describe("formatText", () => {
  it("skips clean files", () => {
    const result = makeResult({ valid: true, issues: [] });
    const output = formatText([result], false);
    // Clean files produce no file header
    expect(output).not.toContain("test.fhir.json");
  });

  it("formats errors with 1-based positions", () => {
    const result = makeResult({
      valid: false,
      issues: [
        makeIssue("error", "Patient.id", "Bad id", "INVALID_TYPE", 2, 5, 10),
      ],
    });
    const output = formatText([result], false);
    // 0-based line 2 → 1-based line 3, 0-based col 5 → 1-based col 6
    expect(output).toContain("3:6");
    expect(output).toContain("error");
    expect(output).toContain("Bad id");
    expect(output).toContain("INVALID_TYPE");
  });

  it("formats warnings", () => {
    const result = makeResult({
      valid: true,
      issues: [
        makeIssue("warning", "Patient.foo", "Unknown property", "UNKNOWN_PROPERTY", 3, 2, 8),
      ],
    });
    const output = formatText([result], false);
    expect(output).toContain("warning");
    expect(output).toContain("Unknown property");
  });

  it("formats info issues", () => {
    const result = makeResult({
      valid: true,
      issues: [
        makeIssue("info", "Patient.meta", "Info msg", "INFO_CODE", 1, 0, 5),
      ],
    });
    const output = formatText([result], false);
    expect(output).toContain("info");
    expect(output).toContain("Info msg");
  });

  it("shows summary with counts", () => {
    const result = makeResult({
      valid: false,
      issues: [
        makeIssue("error", "Patient.id", "Err1", "E1", 0, 0, 1),
        makeIssue("warning", "Patient.foo", "Warn1", "W1", 1, 0, 1),
        makeIssue("warning", "Patient.bar", "Warn2", "W2", 2, 0, 1),
      ],
    });
    const output = formatText([result], false);
    expect(output).toContain("3 problems");
    expect(output).toContain("1 error");
    expect(output).toContain("2 warnings");
  });

  it("suppresses summary in quiet mode", () => {
    const result = makeResult({
      valid: false,
      issues: [
        makeIssue("error", "Patient.id", "Err1", "E1", 0, 0, 1),
      ],
    });
    const output = formatText([result], true);
    expect(output).not.toContain("problem");
  });

  it("formats parse errors", () => {
    const result = makeResult({
      valid: false,
      parseError: "Invalid JSON in 'broken.json'",
    });
    const output = formatText([result], false);
    expect(output).toContain("Invalid JSON");
  });

  it("handles issues without positions", () => {
    const result = makeResult({
      valid: false,
      issues: [
        {
          issue: {
            severity: "error",
            path: "Patient.missing",
            message: "Required field",
            code: "REQUIRED_FIELD",
          },
          position: undefined,
        },
      ],
    });
    const output = formatText([result], false);
    // Should show 0:0 for missing positions
    expect(output).toContain("0:0");
    expect(output).toContain("Required field");
  });

  it("formats multiple files", () => {
    const results: FileResult[] = [
      makeResult({
        file: "a.fhir.json",
        valid: false,
        issues: [makeIssue("error", "Patient.x", "Err", "E1", 0, 0, 1)],
      }),
      makeResult({
        file: "b.fhir.json",
        valid: false,
        issues: [makeIssue("warning", "Patient.y", "Warn", "W1", 0, 0, 1)],
      }),
    ];
    const output = formatText(results, false);
    expect(output).toContain("a.fhir.json");
    expect(output).toContain("b.fhir.json");
    expect(output).toContain("2 problems");
  });
});
