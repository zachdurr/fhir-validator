import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll } from "vitest";
import { DefinitionLoader, StructureValidator } from "@fhir-validate/core";
import { validateFile, _setValidator } from "../validate.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, "fixtures");

// Use the test fixture definitions (same as core/vscode tests)
const DEFINITIONS_PATH = resolve(
  __dirname,
  "..",
  "..",
  "..",
  "core",
  "src",
  "__tests__",
  "structure",
  "fixtures",
  "structure-definitions.json",
);

beforeAll(() => {
  const loader = new DefinitionLoader(DEFINITIONS_PATH);
  _setValidator(new StructureValidator(loader));
});

describe("validateFile", () => {
  it("returns valid for a correct Patient resource", async () => {
    const result = await validateFile(
      resolve(FIXTURES, "valid-patient.fhir.json"),
    );
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.parseError).toBeUndefined();
  });

  it("returns issues for an invalid Patient resource", async () => {
    const result = await validateFile(
      resolve(FIXTURES, "invalid-patient.fhir.json"),
    );
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);

    // Should contain UNKNOWN_PROPERTY for unknownField
    const unknown = result.issues.find(
      (i) => i.issue.code === "UNKNOWN_PROPERTY",
    );
    expect(unknown).toBeDefined();
  });

  it("returns parseError for missing file", async () => {
    const result = await validateFile("/nonexistent/path/bad.json");
    expect(result.valid).toBe(false);
    expect(result.parseError).toBeDefined();
    expect(result.parseError).toContain("Could not read file");
  });

  it("filters by severity", async () => {
    const allResult = await validateFile(
      resolve(FIXTURES, "invalid-patient.fhir.json"),
      "info",
    );
    const errorsOnly = await validateFile(
      resolve(FIXTURES, "invalid-patient.fhir.json"),
      "error",
    );
    // Errors-only should have fewer or equal issues than all
    expect(errorsOnly.issues.length).toBeLessThanOrEqual(allResult.issues.length);
    // All issues in errorsOnly should be errors
    for (const i of errorsOnly.issues) {
      expect(i.issue.severity).toBe("error");
    }
  });

  it("respects maxIssues limit", async () => {
    const result = await validateFile(
      resolve(FIXTURES, "invalid-patient.fhir.json"),
      "info",
      1,
    );
    expect(result.issues.length).toBeLessThanOrEqual(1);
  });

  it("resolves positions for issues", async () => {
    const result = await validateFile(
      resolve(FIXTURES, "invalid-patient.fhir.json"),
    );
    // At least some issues should have positions
    const withPositions = result.issues.filter((i) => i.position !== undefined);
    expect(withPositions.length).toBeGreaterThan(0);

    // Positions should be valid (0-based, non-negative)
    for (const i of withPositions) {
      expect(i.position!.line).toBeGreaterThanOrEqual(0);
      expect(i.position!.startChar).toBeGreaterThanOrEqual(0);
    }
  });
});
