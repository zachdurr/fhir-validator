import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import {
  DefinitionLoader,
  StructureValidator,
  resolveJsonPosition,
  type ValidationIssue,
  type JsonPosition,
} from "@fhir-validate/core";

// Use the test fixture from core (Patient, Observation, MedicationRequest + types)
const FIXTURE_PATH = resolve(
  __dirname,
  "..",
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

const loader = new DefinitionLoader(FIXTURE_PATH);
const validator = new StructureValidator(loader);

interface ResolvedDiagnostic {
  issue: ValidationIssue;
  position: JsonPosition | undefined;
}

function validateAndResolve(jsonText: string): ResolvedDiagnostic[] {
  const resource = JSON.parse(jsonText);
  const result = validator.validate(resource);
  return result.issues.map((issue) => ({
    issue,
    position: resolveJsonPosition(jsonText, issue.path),
  }));
}

describe("validation pipeline integration", () => {
  it("valid Patient produces no diagnostics", () => {
    const json = `{
  "resourceType": "Patient",
  "id": "example",
  "active": true,
  "name": [
    {
      "family": "Smith",
      "given": ["John"]
    }
  ]
}`;
    const diagnostics = validateAndResolve(json);
    expect(diagnostics).toHaveLength(0);
  });

  it("unknown property maps to correct line", () => {
    const json = `{
  "resourceType": "Patient",
  "id": "example",
  "unknownField": "oops"
}`;
    const diagnostics = validateAndResolve(json);
    const unknown = diagnostics.find((d) => d.issue.code === "UNKNOWN_PROPERTY");
    expect(unknown).toBeDefined();
    expect(unknown!.position).toBeDefined();
    // "unknownField" value is on line 3
    expect(unknown!.position!.line).toBe(3);
  });

  it("type error in nested array maps to correct line", () => {
    const json = `{
  "resourceType": "Patient",
  "active": "not-a-boolean"
}`;
    const diagnostics = validateAndResolve(json);
    const typeError = diagnostics.find(
      (d) => d.issue.code === "INVALID_TYPE" || d.issue.code === "PRIMITIVE_TYPE_ERROR",
    );
    expect(typeError).toBeDefined();
    expect(typeError!.position).toBeDefined();
    // "not-a-boolean" is on line 2
    expect(typeError!.position!.line).toBe(2);
  });

  it("multiple unknown properties each map to their own line", () => {
    const json = `{
  "resourceType": "Patient",
  "foo": 1,
  "bar": 2,
  "baz": 3
}`;
    const diagnostics = validateAndResolve(json);
    const unknowns = diagnostics.filter((d) => d.issue.code === "UNKNOWN_PROPERTY");
    expect(unknowns).toHaveLength(3);

    // Each should be on a different line (2, 3, 4)
    const lines = unknowns.map((d) => d.position?.line).sort();
    expect(lines).toEqual([2, 3, 4]);
  });

  it("nested object error maps to correct position", () => {
    const json = `{
  "resourceType": "Patient",
  "name": [
    {
      "family": "Smith",
      "badProp": "nope"
    }
  ]
}`;
    const diagnostics = validateAndResolve(json);
    const unknown = diagnostics.find((d) => d.issue.code === "UNKNOWN_PROPERTY");
    expect(unknown).toBeDefined();
    expect(unknown!.position).toBeDefined();
    // "badProp" value is on line 5
    expect(unknown!.position!.line).toBe(5);
  });

  it("missing required field handled gracefully — position is undefined", () => {
    // Observation requires status and code (min: 1)
    const json = `{
  "resourceType": "Observation"
}`;
    const diagnostics = validateAndResolve(json);
    const missing = diagnostics.filter((d) => d.issue.code === "REQUIRED_FIELD");
    expect(missing.length).toBeGreaterThan(0);
    // Missing fields don't exist in the JSON, so position resolution falls back
    // The path for a missing field is like "Observation.status" but the key doesn't exist
    for (const d of missing) {
      // Position is undefined since the key is absent from the JSON
      expect(d.position).toBeUndefined();
    }
  });

  it("cardinality error (array where scalar expected) maps correctly", () => {
    const json = `{
  "resourceType": "Patient",
  "active": [true, false]
}`;
    const diagnostics = validateAndResolve(json);
    const cardError = diagnostics.find((d) => d.issue.code === "CARDINALITY_ERROR");
    expect(cardError).toBeDefined();
  });

  it("issues include code and severity", () => {
    const json = `{
  "resourceType": "Patient",
  "unknownProp": true
}`;
    const diagnostics = validateAndResolve(json);
    expect(diagnostics.length).toBeGreaterThan(0);
    for (const d of diagnostics) {
      expect(d.issue.code).toBeTruthy();
      expect(["error", "warning", "info"]).toContain(d.issue.severity);
      expect(d.issue.message).toBeTruthy();
    }
  });
});
