import { describe, it, expect } from "vitest";
import { MessageFormatter } from "../../messages/MessageFormatter.js";
import type { PropertyContext } from "../../messages/MessageFormatter.js";

const fmt = new MessageFormatter();

function makeCtx(overrides: Partial<PropertyContext> = {}): PropertyContext {
  return {
    resourceType: "Patient",
    fhirPath: "Patient",
    jsonPath: "Patient",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// "Did you mean?" for unknown properties
// ---------------------------------------------------------------------------
describe("unknown property suggestions", () => {
  it('suggests "name" for "nme"', () => {
    const issue = fmt.formatUnknownProperty("nme", makeCtx({
      validProperties: ["name", "status", "active", "gender"],
    }));
    expect(issue.code).toBe("UNKNOWN_PROPERTY");
    expect(issue.message).toContain('Did you mean "name"');
  });

  it('suggests "status" for "statis"', () => {
    const issue = fmt.formatUnknownProperty("statis", makeCtx({
      fhirPath: "Observation",
      jsonPath: "Observation",
      resourceType: "Observation",
      validProperties: ["status", "code", "subject", "value[x]"],
    }));
    expect(issue.message).toContain('Did you mean "status"');
  });

  it("does not suggest for completely unrelated string", () => {
    const issue = fmt.formatUnknownProperty("zzzzz", makeCtx({
      validProperties: ["name", "status", "active"],
    }));
    expect(issue.message).not.toContain("Did you mean");
  });

  it("lists valid properties in details", () => {
    const issue = fmt.formatUnknownProperty("foo", makeCtx({
      validProperties: ["name", "active", "gender"],
    }));
    expect(issue.details).toContain("name");
    expect(issue.details).toContain("active");
    expect(issue.details).toContain("gender");
  });
});

// ---------------------------------------------------------------------------
// "Did you mean?" for unknown resource types
// ---------------------------------------------------------------------------
describe("unknown resource type suggestions", () => {
  const knownTypes = ["Patient", "Observation", "MedicationRequest", "Condition", "Encounter"];

  it('suggests "Patient" for "Pateint"', () => {
    const issue = fmt.formatUnknownResourceType("Pateint", knownTypes);
    expect(issue.code).toBe("UNKNOWN_RESOURCE_TYPE");
    expect(issue.message).toContain('Did you mean "Patient"');
  });

  it('suggests "Observation" for "Obsrvation"', () => {
    const issue = fmt.formatUnknownResourceType("Obsrvation", knownTypes);
    expect(issue.message).toContain('Did you mean "Observation"');
  });

  it("does not suggest for completely unknown type", () => {
    const issue = fmt.formatUnknownResourceType("FooBarBaz", knownTypes);
    expect(issue.message).not.toContain("Did you mean");
  });
});

// ---------------------------------------------------------------------------
// URL generation
// ---------------------------------------------------------------------------
describe("URL generation", () => {
  it("generates resource field URL for resource properties", () => {
    const issue = fmt.formatRequiredField("status", makeCtx({
      resourceType: "Observation",
      fhirPath: "Observation",
      jsonPath: "Observation",
    }));
    expect(issue.url).toContain("observation-definitions.html#Observation.status");
  });

  it("generates resourcelist URL for unknown resource type", () => {
    const issue = fmt.formatUnknownResourceType("FakeResource", []);
    expect(issue.url).toContain("resourcelist.html");
  });

  it("generates datatypes URL for primitive type errors", () => {
    const issue = fmt.formatPrimitiveTypeError(
      "Expected boolean, got string",
      "boolean",
      makeCtx({ fhirPath: "Patient.active", jsonPath: "Patient.active" }),
    );
    expect(issue.url).toContain("datatypes.html#boolean");
  });

  it("generates datatypes URL for complex type errors", () => {
    const issue = fmt.formatExpectedObject("HumanName", "string", makeCtx({
      fhirPath: "HumanName.family",
      jsonPath: "Patient.name[0].family",
    }));
    expect(issue.url).toContain("datatypes");
  });
});

// ---------------------------------------------------------------------------
// Type examples in messages
// ---------------------------------------------------------------------------
describe("type examples in messages", () => {
  it("includes HumanName example", () => {
    const issue = fmt.formatExpectedObject("HumanName", "string", makeCtx({
      fhirPath: "Patient.name",
      jsonPath: "Patient.name[0]",
    }));
    expect(issue.message).toContain("family");
    expect(issue.message).toContain("Smith");
  });

  it("includes CodeableConcept example", () => {
    const issue = fmt.formatExpectedObject("CodeableConcept", 42, makeCtx({
      fhirPath: "Observation.code",
      jsonPath: "Observation.code",
    }));
    expect(issue.message).toContain("coding");
  });

  it("includes Quantity example", () => {
    const issue = fmt.formatExpectedObject("Quantity", "string", makeCtx({
      fhirPath: "Observation.valueQuantity",
      jsonPath: "Observation.valueQuantity",
    }));
    expect(issue.message).toContain("mmHg");
  });

  it("includes Reference example", () => {
    const issue = fmt.formatExpectedObject("Reference", [], makeCtx({
      fhirPath: "Observation.subject",
      jsonPath: "Observation.subject",
    }));
    expect(issue.message).toContain("Patient/123");
  });
});

// ---------------------------------------------------------------------------
// Short descriptions in required field messages
// ---------------------------------------------------------------------------
describe("short descriptions", () => {
  it("includes elementDef.short in required field message", () => {
    const issue = fmt.formatRequiredField("status", makeCtx({
      resourceType: "Observation",
      fhirPath: "Observation",
      jsonPath: "Observation",
      elementDef: {
        path: "Observation.status",
        min: 1,
        max: "1",
        short: "registered | preliminary | final | amended +",
      },
    }));
    expect(issue.message).toContain("registered | preliminary | final | amended +");
  });

  it("omits short description when elementDef.short is absent", () => {
    const issue = fmt.formatRequiredField("status", makeCtx({
      resourceType: "Observation",
      fhirPath: "Observation",
      jsonPath: "Observation",
      elementDef: { path: "Observation.status", min: 1, max: "1" },
    }));
    expect(issue.message).not.toContain("(");
  });
});

// ---------------------------------------------------------------------------
// Common developer mistakes
// ---------------------------------------------------------------------------
describe("common developer mistakes", () => {
  it("string where boolean expected shows format hint", () => {
    const issue = fmt.formatPrimitiveTypeError(
      'Expected boolean, got string',
      "boolean",
      makeCtx({ fhirPath: "Patient.active", jsonPath: "Patient.active" }),
    );
    expect(issue.message).toContain("true or false");
  });

  it("object where array expected shows wrap hint", () => {
    const issue = fmt.formatCardinalityScalar("name", "*", makeCtx({
      resourceType: "Patient",
      fhirPath: "Patient",
      jsonPath: "Patient",
    }));
    expect(issue.details).toContain("wrapped in a JSON array");
  });

  it("non-object where HumanName expected shows example", () => {
    const issue = fmt.formatExpectedObject("HumanName", "string", makeCtx({
      fhirPath: "Patient.name",
      jsonPath: "Patient.name[0]",
    }));
    expect(issue.message).toContain("HumanName");
    expect(issue.message).toContain("family");
  });

  it("missing required status shows cardinality", () => {
    const issue = fmt.formatRequiredField("status", makeCtx({
      resourceType: "Observation",
      fhirPath: "Observation",
      jsonPath: "Observation",
      elementDef: { path: "Observation.status", min: 1, max: "1" },
    }));
    expect(issue.details).toContain("minimum cardinality of 1");
  });

  it("null in array explains FHIR constraint", () => {
    const issue = fmt.formatNullArrayElement(2, makeCtx({
      jsonPath: "Patient.name[2]",
      fhirPath: "Patient.name",
    }));
    expect(issue.details).toContain("must not contain null");
    expect(issue.details).toContain("index 2");
  });

  it("array where scalar expected shows remove hint", () => {
    const issue = fmt.formatCardinalityArray("active", "1", makeCtx({
      resourceType: "Patient",
      fhirPath: "Patient",
      jsonPath: "Patient",
    }));
    expect(issue.details).toContain("Remove the array wrapper");
  });

  it("multiple choice type variants explains constraint", () => {
    const issue = fmt.formatChoiceTypeMultiple("value", ["valueString", "valueInteger"], makeCtx({
      resourceType: "Observation",
      fhirPath: "Observation",
      jsonPath: "Observation",
    }));
    expect(issue.details).toContain("only one variant");
    expect(issue.message).toContain("valueString");
    expect(issue.message).toContain("valueInteger");
  });

  it("required choice type lists available variants", () => {
    const issue = fmt.formatRequiredChoiceType(
      "value",
      [
        { concrete: "valueString", typeCode: "string" },
        { concrete: "valueQuantity", typeCode: "Quantity" },
        { concrete: "valueBoolean", typeCode: "boolean" },
      ],
      makeCtx({
        resourceType: "Observation",
        fhirPath: "Observation",
        jsonPath: "Observation",
      }),
    );
    expect(issue.details).toContain("valueString");
    expect(issue.details).toContain("valueQuantity");
    expect(issue.details).toContain("valueBoolean");
  });
});

// ---------------------------------------------------------------------------
// Resource-level formatters
// ---------------------------------------------------------------------------
describe("resource-level formatters", () => {
  it("formatInvalidResource identifies null", () => {
    const issue = fmt.formatInvalidResource(null);
    expect(issue.code).toBe("INVALID_RESOURCE");
    expect(issue.message).toContain("null");
  });

  it("formatInvalidResource identifies array", () => {
    const issue = fmt.formatInvalidResource([]);
    expect(issue.message).toContain("array");
  });

  it("formatInvalidResource identifies number", () => {
    const issue = fmt.formatInvalidResource(42);
    expect(issue.message).toContain("number");
  });

  it("formatMissingResourceType provides helpful details", () => {
    const issue = fmt.formatMissingResourceType();
    expect(issue.code).toBe("MISSING_RESOURCE_TYPE");
    expect(issue.details).toContain("resourceType");
  });

  it("formatInvalidResourceType handles empty string", () => {
    const issue = fmt.formatInvalidResourceType("");
    expect(issue.code).toBe("INVALID_RESOURCE_TYPE");
    expect(issue.message).toContain("empty/whitespace");
  });

  it("formatInvalidResourceType handles number", () => {
    const issue = fmt.formatInvalidResourceType(123);
    expect(issue.message).toContain("number");
  });
});

// ---------------------------------------------------------------------------
// All issues have url field
// ---------------------------------------------------------------------------
describe("all issues include url", () => {
  it("formatInvalidResource has url", () => {
    expect(fmt.formatInvalidResource(null).url).toBeDefined();
  });

  it("formatMissingResourceType has url", () => {
    expect(fmt.formatMissingResourceType().url).toBeDefined();
  });

  it("formatInvalidResourceType has url", () => {
    expect(fmt.formatInvalidResourceType("").url).toBeDefined();
  });

  it("formatUnknownResourceType has url", () => {
    expect(fmt.formatUnknownResourceType("Foo", []).url).toBeDefined();
  });

  it("formatUnknownProperty has url", () => {
    expect(fmt.formatUnknownProperty("foo", makeCtx()).url).toBeDefined();
  });

  it("formatRequiredField has url", () => {
    expect(fmt.formatRequiredField("status", makeCtx()).url).toBeDefined();
  });

  it("formatNullArrayElement has url", () => {
    expect(fmt.formatNullArrayElement(0, makeCtx()).url).toBeDefined();
  });
});
