import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DefinitionLoader } from "../../loader/DefinitionLoader.js";
import { StructureValidator } from "../../structure/StructureValidator.js";
import type { ValidationIssue } from "../../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFINITIONS_PATH = resolve(__dirname, "../structure/fixtures/structure-definitions.json");
const FIXTURES_DIR = resolve(__dirname, "../fixtures");

let validator: StructureValidator;

beforeAll(() => {
  const loader = new DefinitionLoader(DEFINITIONS_PATH);
  validator = new StructureValidator(loader);
});

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(resolve(FIXTURES_DIR, name), "utf-8"));
}

function findIssue(
  issues: ValidationIssue[],
  code: string,
  pathPrefix?: string,
): ValidationIssue | undefined {
  return issues.find(
    (i) => i.code === code && (pathPrefix === undefined || i.path.startsWith(pathPrefix)),
  );
}

function countIssues(issues: ValidationIssue[], code: string): number {
  return issues.filter((i) => i.code === code).length;
}

// ---------------------------------------------------------------------------
// Valid fixtures
// ---------------------------------------------------------------------------
describe("valid fixture files", () => {
  it("valid-patient.json passes validation with zero errors", () => {
    const patient = loadFixture("valid-patient.json");
    const result = validator.validate(patient);
    expect(result.valid).toBe(true);
    expect(result.issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });

  it("valid-observation.json passes validation with zero errors", () => {
    const observation = loadFixture("valid-observation.json");
    const result = validator.validate(observation);
    expect(result.valid).toBe(true);
    expect(result.issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });

  it("valid-medication-request.json passes validation with zero errors", () => {
    const medReq = loadFixture("valid-medication-request.json");
    const result = validator.validate(medReq);
    expect(result.valid).toBe(true);
    expect(result.issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Invalid fixtures
// ---------------------------------------------------------------------------
describe("invalid fixture files", () => {
  it("invalid-missing-required.json flags missing status and code", () => {
    const resource = loadFixture("invalid-missing-required.json");
    const result = validator.validate(resource);
    expect(result.valid).toBe(false);
    expect(findIssue(result.issues, "REQUIRED_FIELD", "Observation.status")).toBeDefined();
    expect(findIssue(result.issues, "REQUIRED_FIELD", "Observation.code")).toBeDefined();
  });

  it("invalid-wrong-types.json flags type errors for active, birthDate, gender, name[0].family", () => {
    const resource = loadFixture("invalid-wrong-types.json");
    const result = validator.validate(resource);
    expect(result.valid).toBe(false);
    expect(findIssue(result.issues, "INVALID_TYPE", "Patient.active")).toBeDefined();
    expect(findIssue(result.issues, "INVALID_TYPE", "Patient.birthDate")).toBeDefined();
    expect(findIssue(result.issues, "INVALID_TYPE", "Patient.gender")).toBeDefined();
    expect(findIssue(result.issues, "INVALID_TYPE", "Patient.name[0].family")).toBeDefined();
  });

  it("invalid-unknown-properties.json flags nmae, actve, gnder as unknown", () => {
    const resource = loadFixture("invalid-unknown-properties.json");
    const result = validator.validate(resource);
    expect(result.valid).toBe(false);
    expect(countIssues(result.issues, "UNKNOWN_PROPERTY")).toBe(3);
    expect(findIssue(result.issues, "UNKNOWN_PROPERTY", "Patient.nmae")).toBeDefined();
    expect(findIssue(result.issues, "UNKNOWN_PROPERTY", "Patient.actve")).toBeDefined();
    expect(findIssue(result.issues, "UNKNOWN_PROPERTY", "Patient.gnder")).toBeDefined();
  });

  it("invalid-choice-type.json flags multiple choice type variants", () => {
    const resource = loadFixture("invalid-choice-type.json");
    const result = validator.validate(resource);
    expect(result.valid).toBe(false);
    expect(findIssue(result.issues, "CHOICE_TYPE_MULTIPLE")).toBeDefined();
  });

  it("invalid-cardinality.json flags array for active and scalar for name", () => {
    const resource = loadFixture("invalid-cardinality.json");
    const result = validator.validate(resource);
    expect(result.valid).toBe(false);
    expect(findIssue(result.issues, "CARDINALITY_ERROR", "Patient.active")).toBeDefined();
    expect(findIssue(result.issues, "CARDINALITY_ERROR", "Patient.name")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Edge case fixtures
// ---------------------------------------------------------------------------
describe("edge case fixture files", () => {
  it("edge-empty-resource.json (Patient with only resourceType) is valid", () => {
    const resource = loadFixture("edge-empty-resource.json");
    const result = validator.validate(resource);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("edge-minimal-valid.json (minimal Observation) is valid", () => {
    const resource = loadFixture("edge-minimal-valid.json");
    const result = validator.validate(resource);
    expect(result.valid).toBe(true);
    expect(result.issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });
});
