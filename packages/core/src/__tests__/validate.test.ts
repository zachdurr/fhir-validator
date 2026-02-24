import { describe, it, expect } from "vitest";
import { validate } from "../validate.js";

describe("validate", () => {
  it("returns error for null input", () => {
    const result = validate(null);
    expect(result.valid).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].code).toBe("INVALID_RESOURCE");
  });

  it("returns error for undefined input", () => {
    const result = validate(undefined);
    expect(result.valid).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].code).toBe("INVALID_RESOURCE");
  });

  it("returns error for array input", () => {
    const result = validate([]);
    expect(result.valid).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].code).toBe("INVALID_RESOURCE");
  });

  it("returns error for missing resourceType", () => {
    const result = validate({ id: "123" });
    expect(result.valid).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].code).toBe("MISSING_RESOURCE_TYPE");
  });

  it("returns error for non-string resourceType", () => {
    const result = validate({ resourceType: 123 });
    expect(result.valid).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].code).toBe("INVALID_RESOURCE_TYPE");
  });

  it("returns error for empty resourceType", () => {
    const result = validate({ resourceType: "" });
    expect(result.valid).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].code).toBe("INVALID_RESOURCE_TYPE");
  });

  it("returns error for whitespace-only resourceType", () => {
    const result = validate({ resourceType: "   " });
    expect(result.valid).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].code).toBe("INVALID_RESOURCE_TYPE");
  });

  it("returns valid for minimal FHIR resource", () => {
    const result = validate({ resourceType: "Patient" });
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("returns valid for resource with additional fields", () => {
    const result = validate({
      resourceType: "Patient",
      id: "123",
      name: [{ family: "Smith" }],
    });
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("accepts options parameter", () => {
    const result = validate({ resourceType: "Patient" }, { version: "R4" });
    expect(result.valid).toBe(true);
  });
});
