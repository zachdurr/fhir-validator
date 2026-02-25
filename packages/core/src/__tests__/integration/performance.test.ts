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

function generatePatient(index: number): Record<string, unknown> {
  const genders = ["male", "female", "other", "unknown"];
  const uses = ["official", "nickname", "temp", "maiden"];

  return {
    resourceType: "Patient",
    id: `perf-pat-${index}`,
    active: index % 3 !== 0,
    gender: genders[index % genders.length],
    birthDate: `${1950 + (index % 50)}-${String((index % 12) + 1).padStart(2, "0")}-${String((index % 28) + 1).padStart(2, "0")}`,
    identifier: [
      {
        use: "official",
        system: "http://hospital.example.org/mrn",
        value: `MRN-${10000 + index}`,
      },
    ],
    name: [
      {
        use: uses[index % uses.length],
        family: `Family-${index}`,
        given: [`Given-${index}`, `Middle-${index}`],
      },
    ],
    contact:
      index % 5 === 0
        ? [
            {
              name: { family: `Contact-${index}`, given: [`ContactGiven-${index}`] },
              relationship: [
                {
                  coding: [
                    {
                      system: "http://terminology.hl7.org/CodeSystem/v2-0131",
                      code: "N",
                    },
                  ],
                },
              ],
            },
          ]
        : undefined,
  };
}

describe("performance", () => {
  it("validates 100 Patient resources in under 1 second", () => {
    const patients = Array.from({ length: 100 }, (_, i) => generatePatient(i));

    const start = performance.now();
    for (const patient of patients) {
      const result = validator.validate(patient);
      expect(result.valid).toBe(true);
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(1000);
  });

  it("validates 100 Observation resources in under 1 second", () => {
    const observations = Array.from({ length: 100 }, (_, i) => ({
      resourceType: "Observation",
      id: `perf-obs-${i}`,
      status: "final",
      code: {
        coding: [{ system: "http://loinc.org", code: `${1000 + i}-${i % 10}` }],
        text: `Test observation ${i}`,
      },
      valueQuantity: {
        value: 60 + (i % 100),
        unit: "bpm",
        system: "http://unitsofmeasure.org",
        code: "/min",
      },
      effectiveDateTime: `2024-${String((i % 12) + 1).padStart(2, "0")}-15T10:00:00Z`,
    }));

    const start = performance.now();
    for (const obs of observations) {
      const result = validator.validate(obs);
      expect(result.valid).toBe(true);
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(1000);
  });

  it("validates a mix of 100 resources (Patient + Observation + MedicationRequest) in under 1 second", () => {
    const resources: Record<string, unknown>[] = [];

    for (let i = 0; i < 100; i++) {
      const mod = i % 3;
      if (mod === 0) {
        resources.push(generatePatient(i));
      } else if (mod === 1) {
        resources.push({
          resourceType: "Observation",
          status: "final",
          code: { text: `Test ${i}` },
          valueInteger: i,
        });
      } else {
        resources.push({
          resourceType: "MedicationRequest",
          status: "active",
          intent: "order",
          subject: { reference: `Patient/${i}` },
        });
      }
    }

    const start = performance.now();
    for (const resource of resources) {
      const result = validator.validate(resource);
      expect(result.valid).toBe(true);
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(1000);
  });
});
