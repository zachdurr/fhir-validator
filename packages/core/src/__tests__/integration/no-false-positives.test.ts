import { describe, it, expect, beforeAll } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DefinitionLoader } from "../../loader/DefinitionLoader.js";
import { StructureValidator } from "../../structure/StructureValidator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFINITIONS_PATH = resolve(__dirname, "../structure/fixtures/structure-definitions.json");

let validator: StructureValidator;

beforeAll(() => {
  const loader = new DefinitionLoader(DEFINITIONS_PATH);
  validator = new StructureValidator(loader);
});

function expectValid(resource: unknown, label: string): void {
  const result = validator.validate(resource);
  const errors = result.issues.filter((i) => i.severity === "error");
  expect(errors, `"${label}" should have zero errors but got: ${JSON.stringify(errors)}`).toHaveLength(0);
  expect(result.valid, `"${label}" should be valid`).toBe(true);
}

// ---------------------------------------------------------------------------
// Patient variations
// ---------------------------------------------------------------------------
describe("Patient — no false positives", () => {
  it("minimal Patient (resourceType only)", () => {
    expectValid({ resourceType: "Patient" }, "minimal Patient");
  });

  it("Patient with id", () => {
    expectValid({ resourceType: "Patient", id: "p1" }, "Patient with id");
  });

  it("Patient with single name", () => {
    expectValid(
      { resourceType: "Patient", name: [{ family: "Smith" }] },
      "Patient with single name",
    );
  });

  it("Patient with full name (use, family, given, prefix, suffix)", () => {
    expectValid(
      {
        resourceType: "Patient",
        name: [{
          use: "official",
          family: "Johnson",
          given: ["Robert", "James"],
          prefix: ["Mr."],
          suffix: ["III"],
        }],
      },
      "Patient with full name",
    );
  });

  it("Patient with multiple names", () => {
    expectValid(
      {
        resourceType: "Patient",
        name: [
          { use: "official", family: "Smith", given: ["John"] },
          { use: "nickname", given: ["Johnny"] },
          { use: "maiden", family: "Doe" },
        ],
      },
      "Patient with multiple names",
    );
  });

  it("Patient with identifiers", () => {
    expectValid(
      {
        resourceType: "Patient",
        identifier: [
          { system: "http://hospital.example.org/mrn", value: "12345" },
          { use: "official", system: "http://hl7.org/fhir/sid/us-ssn", value: "999-99-9999" },
        ],
      },
      "Patient with identifiers",
    );
  });

  it("Patient with all scalar fields", () => {
    expectValid(
      {
        resourceType: "Patient",
        id: "full-patient",
        active: true,
        gender: "male",
        birthDate: "1990-06-15",
      },
      "Patient with all scalars",
    );
  });

  it("Patient with contact (backbone element)", () => {
    expectValid(
      {
        resourceType: "Patient",
        contact: [{
          name: { family: "Doe", given: ["Jane"] },
          relationship: [{
            coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0131", code: "N" }],
            text: "Spouse",
          }],
        }],
      },
      "Patient with contact",
    );
  });

  it("Patient with extension array", () => {
    expectValid(
      { resourceType: "Patient", extension: [] },
      "Patient with extension",
    );
  });

  it("Patient with name period", () => {
    expectValid(
      {
        resourceType: "Patient",
        name: [{
          family: "Smith",
          period: { start: "2020-01-01", end: "2024-12-31" },
        }],
      },
      "Patient with name period",
    );
  });
});

// ---------------------------------------------------------------------------
// Observation variations
// ---------------------------------------------------------------------------
describe("Observation — no false positives", () => {
  it("minimal Observation (status + code text only)", () => {
    expectValid(
      { resourceType: "Observation", status: "final", code: { text: "Test" } },
      "minimal Observation",
    );
  });

  it("Observation with valueQuantity", () => {
    expectValid(
      {
        resourceType: "Observation",
        status: "final",
        code: { coding: [{ system: "http://loinc.org", code: "8867-4" }] },
        valueQuantity: { value: 72, unit: "bpm", system: "http://unitsofmeasure.org", code: "/min" },
      },
      "Observation valueQuantity",
    );
  });

  it("Observation with valueString", () => {
    expectValid(
      {
        resourceType: "Observation",
        status: "final",
        code: { text: "Note" },
        valueString: "Patient reports feeling well",
      },
      "Observation valueString",
    );
  });

  it("Observation with valueBoolean", () => {
    expectValid(
      {
        resourceType: "Observation",
        status: "preliminary",
        code: { text: "Pregnant" },
        valueBoolean: false,
      },
      "Observation valueBoolean",
    );
  });

  it("Observation with valueInteger", () => {
    expectValid(
      {
        resourceType: "Observation",
        status: "final",
        code: { text: "Score" },
        valueInteger: 8,
      },
      "Observation valueInteger",
    );
  });

  it("Observation with effectiveDateTime", () => {
    expectValid(
      {
        resourceType: "Observation",
        status: "final",
        code: { text: "Test" },
        effectiveDateTime: "2024-03-15T14:30:00Z",
      },
      "Observation effectiveDateTime",
    );
  });

  it("Observation with effectivePeriod", () => {
    expectValid(
      {
        resourceType: "Observation",
        status: "final",
        code: { text: "Test" },
        effectivePeriod: {
          start: "2024-01-01T00:00:00Z",
          end: "2024-06-30T23:59:59Z",
        },
      },
      "Observation effectivePeriod",
    );
  });

  it("Observation with all statuses", () => {
    for (const status of ["registered", "preliminary", "final", "amended"]) {
      expectValid(
        { resourceType: "Observation", status, code: { text: "Test" } },
        `Observation status=${status}`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// MedicationRequest variations
// ---------------------------------------------------------------------------
describe("MedicationRequest — no false positives", () => {
  it("minimal MedicationRequest", () => {
    expectValid(
      {
        resourceType: "MedicationRequest",
        status: "active",
        intent: "order",
        subject: { reference: "Patient/123" },
      },
      "minimal MedicationRequest",
    );
  });

  it("MedicationRequest with display on subject", () => {
    expectValid(
      {
        resourceType: "MedicationRequest",
        status: "completed",
        intent: "plan",
        subject: {
          reference: "Patient/456",
          type: "http://hl7.org/fhir/StructureDefinition/Patient",
          display: "John Smith",
        },
      },
      "MedicationRequest with display",
    );
  });

  it("MedicationRequest with id", () => {
    expectValid(
      {
        resourceType: "MedicationRequest",
        id: "medrx-002",
        status: "on-hold",
        intent: "proposal",
        subject: { reference: "Patient/789" },
      },
      "MedicationRequest with id",
    );
  });
});
