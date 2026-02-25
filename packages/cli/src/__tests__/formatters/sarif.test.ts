import { describe, it, expect } from "vitest";
import { formatSarif } from "../../formatters/sarif.js";
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

describe("formatSarif", () => {
  it("produces valid SARIF v2.1.0 structure", () => {
    const result = makeResult();
    const parsed = JSON.parse(formatSarif([result]));
    expect(parsed.version).toBe("2.1.0");
    expect(parsed.$schema).toContain("sarif-schema-2.1.0");
    expect(parsed.runs).toHaveLength(1);
    expect(parsed.runs[0].tool.driver.name).toBe("fhir-validate");
  });

  it("maps error severity to 'error' level", () => {
    const issue: ResolvedIssue = {
      issue: {
        severity: "error",
        path: "Patient.id",
        message: "Bad",
        code: "INVALID_TYPE",
      },
      position: { line: 2, startChar: 5, endChar: 10 },
    };
    const result = makeResult({ valid: false, issues: [issue] });
    const parsed = JSON.parse(formatSarif([result]));
    expect(parsed.runs[0].results[0].level).toBe("error");
  });

  it("maps warning severity to 'warning' level", () => {
    const issue: ResolvedIssue = {
      issue: {
        severity: "warning",
        path: "Patient.foo",
        message: "Unknown",
        code: "UNKNOWN_PROPERTY",
      },
      position: { line: 0, startChar: 0, endChar: 5 },
    };
    const result = makeResult({ issues: [issue] });
    const parsed = JSON.parse(formatSarif([result]));
    expect(parsed.runs[0].results[0].level).toBe("warning");
  });

  it("maps info severity to 'note' level", () => {
    const issue: ResolvedIssue = {
      issue: {
        severity: "info",
        path: "Patient.meta",
        message: "Info",
        code: "INFO",
      },
      position: { line: 0, startChar: 0, endChar: 1 },
    };
    const result = makeResult({ issues: [issue] });
    const parsed = JSON.parse(formatSarif([result]));
    expect(parsed.runs[0].results[0].level).toBe("note");
  });

  it("uses 1-based positions in regions", () => {
    const issue: ResolvedIssue = {
      issue: {
        severity: "error",
        path: "Patient.id",
        message: "Bad",
        code: "E1",
      },
      position: { line: 2, startChar: 5, endChar: 10 },
    };
    const result = makeResult({ valid: false, issues: [issue] });
    const parsed = JSON.parse(formatSarif([result]));
    const region = parsed.runs[0].results[0].locations[0].physicalLocation.region;
    expect(region.startLine).toBe(3);
    expect(region.startColumn).toBe(6);
    expect(region.endColumn).toBe(11);
  });

  it("deduplicates rules", () => {
    const issues: ResolvedIssue[] = [
      {
        issue: { severity: "warning", path: "Patient.foo", message: "Unknown foo", code: "UNKNOWN_PROPERTY" },
        position: { line: 0, startChar: 0, endChar: 1 },
      },
      {
        issue: { severity: "warning", path: "Patient.bar", message: "Unknown bar", code: "UNKNOWN_PROPERTY" },
        position: { line: 1, startChar: 0, endChar: 1 },
      },
    ];
    const result = makeResult({ issues });
    const parsed = JSON.parse(formatSarif([result]));
    // Only one rule even though two results share it
    expect(parsed.runs[0].tool.driver.rules).toHaveLength(1);
    expect(parsed.runs[0].results).toHaveLength(2);
  });

  it("uses file:// URIs for local files", () => {
    const issue: ResolvedIssue = {
      issue: { severity: "error", path: "Patient.id", message: "Bad", code: "E1" },
      position: { line: 0, startChar: 0, endChar: 1 },
    };
    const result = makeResult({ valid: false, filePath: "/path/to/test.fhir.json", issues: [issue] });
    const parsed = JSON.parse(formatSarif([result]));
    const uri = parsed.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri;
    expect(uri).toMatch(/^file:\/\//);
  });

  it("uses 'stdin' URI for stdin input", () => {
    const issue: ResolvedIssue = {
      issue: { severity: "error", path: "Patient.id", message: "Bad", code: "E1" },
      position: { line: 0, startChar: 0, endChar: 1 },
    };
    const result = makeResult({ valid: false, filePath: "<stdin>", issues: [issue] });
    const parsed = JSON.parse(formatSarif([result]));
    const uri = parsed.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri;
    expect(uri).toBe("stdin");
  });

  it("handles parse errors as PARSE_ERROR rule", () => {
    const result = makeResult({ valid: false, parseError: "Invalid JSON" });
    const parsed = JSON.parse(formatSarif([result]));
    expect(parsed.runs[0].results[0].ruleId).toBe("PARSE_ERROR");
    expect(parsed.runs[0].results[0].level).toBe("error");
    expect(parsed.runs[0].tool.driver.rules[0].id).toBe("PARSE_ERROR");
  });
});
