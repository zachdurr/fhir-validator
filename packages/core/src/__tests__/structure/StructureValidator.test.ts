import { describe, it, expect, beforeAll } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DefinitionLoader } from "../../loader/DefinitionLoader.js";
import { StructureValidator } from "../../structure/StructureValidator.js";
import type { ValidationIssue } from "../../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_PATH = resolve(__dirname, "fixtures", "structure-definitions.json");

let validator: StructureValidator;

beforeAll(() => {
  const loader = new DefinitionLoader(FIXTURES_PATH);
  validator = new StructureValidator(loader);
});

function findIssue(issues: ValidationIssue[], code: string, pathPrefix?: string): ValidationIssue | undefined {
  return issues.find(
    (i) => i.code === code && (pathPrefix === undefined || i.path.startsWith(pathPrefix)),
  );
}

// ---------------------------------------------------------------------------
// Basic input validation
// ---------------------------------------------------------------------------
describe("basic input validation", () => {
  it("returns error for null", () => {
    const result = validator.validate(null);
    expect(result.valid).toBe(false);
    expect(result.issues[0].code).toBe("INVALID_RESOURCE");
  });

  it("returns error for undefined", () => {
    const result = validator.validate(undefined);
    expect(result.valid).toBe(false);
    expect(result.issues[0].code).toBe("INVALID_RESOURCE");
  });

  it("returns error for array", () => {
    const result = validator.validate([]);
    expect(result.valid).toBe(false);
    expect(result.issues[0].code).toBe("INVALID_RESOURCE");
  });

  it("returns error for non-object (string)", () => {
    const result = validator.validate("not an object");
    expect(result.valid).toBe(false);
    expect(result.issues[0].code).toBe("INVALID_RESOURCE");
  });

  it("returns error for non-object (number)", () => {
    const result = validator.validate(42);
    expect(result.valid).toBe(false);
    expect(result.issues[0].code).toBe("INVALID_RESOURCE");
  });

  it("returns error for missing resourceType", () => {
    const result = validator.validate({});
    expect(result.valid).toBe(false);
    expect(result.issues[0].code).toBe("MISSING_RESOURCE_TYPE");
  });

  it("returns error for non-string resourceType", () => {
    const result = validator.validate({ resourceType: 123 });
    expect(result.valid).toBe(false);
    expect(result.issues[0].code).toBe("INVALID_RESOURCE_TYPE");
  });

  it("returns error for empty resourceType", () => {
    const result = validator.validate({ resourceType: "" });
    expect(result.valid).toBe(false);
    expect(result.issues[0].code).toBe("INVALID_RESOURCE_TYPE");
  });

  it("returns error for whitespace-only resourceType", () => {
    const result = validator.validate({ resourceType: "   " });
    expect(result.valid).toBe(false);
    expect(result.issues[0].code).toBe("INVALID_RESOURCE_TYPE");
  });

  it("returns error for unknown resourceType", () => {
    const result = validator.validate({ resourceType: "FakeResource" });
    expect(result.valid).toBe(false);
    expect(result.issues[0].code).toBe("UNKNOWN_RESOURCE_TYPE");
  });
});

// ---------------------------------------------------------------------------
// Valid resources
// ---------------------------------------------------------------------------
describe("valid resources", () => {
  it("validates minimal Patient", () => {
    const result = validator.validate({ resourceType: "Patient" });
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("validates full Patient from fixture", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const patient = JSON.parse(
      require("node:fs").readFileSync(
        resolve(__dirname, "fixtures", "patient-example.json"),
        "utf-8",
      ),
    );
    const result = validator.validate(patient);
    expect(result.valid).toBe(true);
    expect(result.issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });

  it("validates Observation with choice types", () => {
    const result = validator.validate({
      resourceType: "Observation",
      status: "final",
      code: {
        coding: [{ system: "http://loinc.org", code: "1234-5" }],
      },
      valueQuantity: {
        value: 120,
        unit: "mmHg",
        system: "http://unitsofmeasure.org",
        code: "mm[Hg]",
      },
      effectiveDateTime: "2024-01-15T10:30:00Z",
    });
    expect(result.valid).toBe(true);
  });

  it("validates MedicationRequest with all required fields", () => {
    const result = validator.validate({
      resourceType: "MedicationRequest",
      status: "active",
      intent: "order",
      subject: {
        reference: "Patient/123",
      },
    });
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Unknown properties
// ---------------------------------------------------------------------------
describe("unknown properties", () => {
  it("flags unknown property", () => {
    const result = validator.validate({
      resourceType: "Patient",
      unknownField: "value",
    });
    expect(result.valid).toBe(false);
    expect(findIssue(result.issues, "UNKNOWN_PROPERTY", "Patient.unknownField")).toBeDefined();
  });

  it("flags multiple unknown properties", () => {
    const result = validator.validate({
      resourceType: "Patient",
      foo: 1,
      bar: 2,
    });
    const unknowns = result.issues.filter((i) => i.code === "UNKNOWN_PROPERTY");
    expect(unknowns).toHaveLength(2);
  });

  it("does not flag resourceType as unknown", () => {
    const result = validator.validate({ resourceType: "Patient" });
    expect(result.issues.filter((i) => i.code === "UNKNOWN_PROPERTY")).toHaveLength(0);
  });

  it("does not flag _-prefixed keys as unknown", () => {
    const result = validator.validate({
      resourceType: "Patient",
      active: true,
      _active: { extension: [] },
    });
    expect(result.issues.filter((i) => i.code === "UNKNOWN_PROPERTY")).toHaveLength(0);
  });

  it("does not flag id and extension as unknown", () => {
    const result = validator.validate({
      resourceType: "Patient",
      id: "test-123",
      extension: [],
    });
    expect(result.issues.filter((i) => i.code === "UNKNOWN_PROPERTY")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Required fields
// ---------------------------------------------------------------------------
describe("required fields", () => {
  it("flags missing required field", () => {
    const result = validator.validate({
      resourceType: "Observation",
      code: { text: "test" },
    });
    expect(result.valid).toBe(false);
    expect(findIssue(result.issues, "REQUIRED_FIELD", "Observation.status")).toBeDefined();
  });

  it("flags null required field", () => {
    const result = validator.validate({
      resourceType: "Observation",
      status: null,
      code: { text: "test" },
    });
    expect(result.valid).toBe(false);
    expect(findIssue(result.issues, "REQUIRED_FIELD", "Observation.status")).toBeDefined();
  });

  it("flags multiple missing required fields", () => {
    const result = validator.validate({
      resourceType: "MedicationRequest",
    });
    expect(result.valid).toBe(false);
    const reqIssues = result.issues.filter((i) => i.code === "REQUIRED_FIELD");
    expect(reqIssues.length).toBeGreaterThanOrEqual(3); // status, intent, subject
  });

  it("does not flag absent optional field", () => {
    const result = validator.validate({
      resourceType: "Observation",
      status: "final",
      code: { text: "test" },
    });
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Cardinality
// ---------------------------------------------------------------------------
describe("cardinality", () => {
  it("flags array when max is '1'", () => {
    const result = validator.validate({
      resourceType: "Patient",
      active: [true, false],
    });
    expect(result.valid).toBe(false);
    expect(findIssue(result.issues, "CARDINALITY_ERROR", "Patient.active")).toBeDefined();
  });

  it("flags non-array when max is '*'", () => {
    const result = validator.validate({
      resourceType: "Patient",
      name: { family: "Smith" },
    });
    expect(result.valid).toBe(false);
    expect(findIssue(result.issues, "CARDINALITY_ERROR", "Patient.name")).toBeDefined();
  });

  it("accepts array for max '*'", () => {
    const result = validator.validate({
      resourceType: "Patient",
      name: [{ family: "Smith" }],
    });
    expect(result.valid).toBe(true);
  });

  it("accepts scalar for max '1'", () => {
    const result = validator.validate({
      resourceType: "Patient",
      active: true,
    });
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Primitive type validation
// ---------------------------------------------------------------------------
describe("primitive type validation", () => {
  it("validates correct boolean", () => {
    const result = validator.validate({
      resourceType: "Patient",
      active: true,
    });
    expect(result.valid).toBe(true);
  });

  it("flags incorrect boolean (string)", () => {
    const result = validator.validate({
      resourceType: "Patient",
      active: "true",
    });
    expect(result.valid).toBe(false);
    expect(findIssue(result.issues, "INVALID_TYPE", "Patient.active")).toBeDefined();
  });

  it("validates correct date", () => {
    const result = validator.validate({
      resourceType: "Patient",
      birthDate: "1990-01-15",
    });
    expect(result.valid).toBe(true);
  });

  it("flags incorrect date format", () => {
    const result = validator.validate({
      resourceType: "Patient",
      birthDate: "01/15/1990",
    });
    expect(result.valid).toBe(false);
    expect(findIssue(result.issues, "INVALID_TYPE", "Patient.birthDate")).toBeDefined();
  });

  it("validates correct code", () => {
    const result = validator.validate({
      resourceType: "Patient",
      gender: "male",
    });
    expect(result.valid).toBe(true);
  });

  it("flags incorrect code (number)", () => {
    const result = validator.validate({
      resourceType: "Patient",
      gender: 123,
    });
    expect(result.valid).toBe(false);
    expect(findIssue(result.issues, "INVALID_TYPE", "Patient.gender")).toBeDefined();
  });

  it("validates correct id", () => {
    const result = validator.validate({
      resourceType: "Patient",
      id: "example-123",
    });
    expect(result.valid).toBe(true);
  });

  it("flags incorrect id format", () => {
    const result = validator.validate({
      resourceType: "Patient",
      id: "invalid@id!",
    });
    expect(result.valid).toBe(false);
    expect(findIssue(result.issues, "INVALID_TYPE", "Patient.id")).toBeDefined();
  });

  it("flags boolean where string expected (in nested)", () => {
    const result = validator.validate({
      resourceType: "Patient",
      name: [{ family: 123 }],
    });
    expect(result.valid).toBe(false);
    expect(findIssue(result.issues, "INVALID_TYPE", "Patient.name[0].family")).toBeDefined();
  });

  it("validates correct integer in Observation valueInteger", () => {
    const result = validator.validate({
      resourceType: "Observation",
      status: "final",
      code: { text: "test" },
      valueInteger: 42,
    });
    expect(result.valid).toBe(true);
  });

  it("flags float where integer expected", () => {
    const result = validator.validate({
      resourceType: "Observation",
      status: "final",
      code: { text: "test" },
      valueInteger: 3.14,
    });
    expect(result.valid).toBe(false);
    expect(findIssue(result.issues, "INVALID_TYPE", "Observation.valueInteger")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Choice types
// ---------------------------------------------------------------------------
describe("choice types", () => {
  it("accepts valid choice type variant (valueQuantity)", () => {
    const result = validator.validate({
      resourceType: "Observation",
      status: "final",
      code: { text: "test" },
      valueQuantity: { value: 120, unit: "mmHg" },
    });
    expect(result.valid).toBe(true);
  });

  it("accepts valid choice type variant (valueString)", () => {
    const result = validator.validate({
      resourceType: "Observation",
      status: "final",
      code: { text: "test" },
      valueString: "some text",
    });
    expect(result.valid).toBe(true);
  });

  it("accepts valid choice type variant (valueBoolean)", () => {
    const result = validator.validate({
      resourceType: "Observation",
      status: "final",
      code: { text: "test" },
      valueBoolean: false,
    });
    expect(result.valid).toBe(true);
  });

  it("flags multiple choice type variants", () => {
    const result = validator.validate({
      resourceType: "Observation",
      status: "final",
      code: { text: "test" },
      valueString: "text",
      valueInteger: 42,
    });
    expect(result.valid).toBe(false);
    expect(findIssue(result.issues, "CHOICE_TYPE_MULTIPLE")).toBeDefined();
  });

  it("validates type of choice variant", () => {
    const result = validator.validate({
      resourceType: "Observation",
      status: "final",
      code: { text: "test" },
      valueBoolean: "not a boolean",
    });
    expect(result.valid).toBe(false);
    expect(findIssue(result.issues, "INVALID_TYPE", "Observation.valueBoolean")).toBeDefined();
  });

  it("accepts effectivePeriod choice type", () => {
    const result = validator.validate({
      resourceType: "Observation",
      status: "final",
      code: { text: "test" },
      effectivePeriod: {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
      },
    });
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Nested objects (complex types)
// ---------------------------------------------------------------------------
describe("nested objects", () => {
  it("validates children of complex type", () => {
    const result = validator.validate({
      resourceType: "Patient",
      name: [
        {
          use: "official",
          family: "Smith",
          given: ["John"],
        },
      ],
    });
    expect(result.valid).toBe(true);
  });

  it("flags unknown property in nested complex type", () => {
    const result = validator.validate({
      resourceType: "Patient",
      name: [{ family: "Smith", unknownProp: "test" }],
    });
    expect(result.valid).toBe(false);
    expect(findIssue(result.issues, "UNKNOWN_PROPERTY", "Patient.name[0].unknownProp")).toBeDefined();
  });

  it("validates deep nesting (Coding inside CodeableConcept)", () => {
    const result = validator.validate({
      resourceType: "Observation",
      status: "final",
      code: {
        coding: [
          {
            system: "http://loinc.org",
            code: "1234-5",
            display: "Test",
          },
        ],
        text: "Test observation",
      },
    });
    expect(result.valid).toBe(true);
  });

  it("flags non-object where complex type expected", () => {
    const result = validator.validate({
      resourceType: "Observation",
      status: "final",
      code: "not-an-object",
    });
    expect(result.valid).toBe(false);
    expect(findIssue(result.issues, "INVALID_TYPE", "Observation.code")).toBeDefined();
  });

  it("validates Quantity children", () => {
    const result = validator.validate({
      resourceType: "Observation",
      status: "final",
      code: { text: "test" },
      valueQuantity: {
        value: 98.6,
        unit: "F",
        system: "http://unitsofmeasure.org",
        code: "[degF]",
      },
    });
    expect(result.valid).toBe(true);
  });

  it("flags invalid type in deeply nested property", () => {
    const result = validator.validate({
      resourceType: "Observation",
      status: "final",
      code: {
        coding: [{ system: 123 }],
      },
    });
    expect(result.valid).toBe(false);
    expect(findIssue(result.issues, "INVALID_TYPE", "Observation.code.coding[0].system")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// BackboneElement
// ---------------------------------------------------------------------------
describe("BackboneElement", () => {
  it("validates backbone element children (Patient.contact)", () => {
    const result = validator.validate({
      resourceType: "Patient",
      contact: [
        {
          name: { family: "Doe" },
          relationship: [{ text: "spouse" }],
        },
      ],
    });
    expect(result.valid).toBe(true);
  });

  it("flags unknown property in backbone element", () => {
    const result = validator.validate({
      resourceType: "Patient",
      contact: [
        {
          name: { family: "Doe" },
          unknownField: "test",
        },
      ],
    });
    expect(result.valid).toBe(false);
    expect(findIssue(result.issues, "UNKNOWN_PROPERTY", "Patient.contact[0].unknownField")).toBeDefined();
  });

  it("validates nested complex types inside backbone", () => {
    const result = validator.validate({
      resourceType: "Patient",
      contact: [
        {
          name: {
            family: "Doe",
            given: ["Jane"],
          },
        },
      ],
    });
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Array validation
// ---------------------------------------------------------------------------
describe("array validation", () => {
  it("validates each element in array", () => {
    const result = validator.validate({
      resourceType: "Patient",
      name: [
        { family: "Smith" },
        { family: 123 }, // invalid
      ],
    });
    expect(result.valid).toBe(false);
    expect(findIssue(result.issues, "INVALID_TYPE", "Patient.name[1].family")).toBeDefined();
  });

  it("reports correct indexed paths", () => {
    const result = validator.validate({
      resourceType: "Patient",
      identifier: [
        { system: "http://example.com", value: "A" },
        { system: 42 }, // invalid system at index 1
      ],
    });
    expect(result.valid).toBe(false);
    const issue = findIssue(result.issues, "INVALID_TYPE", "Patient.identifier[1].system");
    expect(issue).toBeDefined();
  });

  it("flags null in array", () => {
    const result = validator.validate({
      resourceType: "Patient",
      name: [null],
    });
    expect(result.valid).toBe(false);
    expect(findIssue(result.issues, "INVALID_TYPE", "Patient.name[0]")).toBeDefined();
  });

  it("validates empty array (no items to validate)", () => {
    const result = validator.validate({
      resourceType: "Patient",
      name: [],
    });
    expect(result.valid).toBe(true);
  });
});
