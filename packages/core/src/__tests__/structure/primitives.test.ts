import { describe, it, expect } from "vitest";
import { validatePrimitive } from "../../structure/primitives.js";

describe("validatePrimitive", () => {
  describe("boolean", () => {
    it("accepts true", () => {
      expect(validatePrimitive("boolean", true)).toBeNull();
    });

    it("accepts false", () => {
      expect(validatePrimitive("boolean", false)).toBeNull();
    });

    it("rejects string", () => {
      expect(validatePrimitive("boolean", "true")).not.toBeNull();
    });

    it("rejects number", () => {
      expect(validatePrimitive("boolean", 1)).not.toBeNull();
    });
  });

  describe("integer", () => {
    it("accepts positive integer", () => {
      expect(validatePrimitive("integer", 42)).toBeNull();
    });

    it("accepts zero", () => {
      expect(validatePrimitive("integer", 0)).toBeNull();
    });

    it("accepts negative integer", () => {
      expect(validatePrimitive("integer", -5)).toBeNull();
    });

    it("rejects float", () => {
      expect(validatePrimitive("integer", 3.14)).not.toBeNull();
    });

    it("rejects string", () => {
      expect(validatePrimitive("integer", "42")).not.toBeNull();
    });

    it("rejects Infinity", () => {
      expect(validatePrimitive("integer", Infinity)).not.toBeNull();
    });

    it("rejects NaN", () => {
      expect(validatePrimitive("integer", NaN)).not.toBeNull();
    });
  });

  describe("positiveInt", () => {
    it("accepts 1", () => {
      expect(validatePrimitive("positiveInt", 1)).toBeNull();
    });

    it("accepts large positive", () => {
      expect(validatePrimitive("positiveInt", 999)).toBeNull();
    });

    it("rejects 0", () => {
      expect(validatePrimitive("positiveInt", 0)).not.toBeNull();
    });

    it("rejects negative", () => {
      expect(validatePrimitive("positiveInt", -1)).not.toBeNull();
    });

    it("rejects float", () => {
      expect(validatePrimitive("positiveInt", 1.5)).not.toBeNull();
    });
  });

  describe("unsignedInt", () => {
    it("accepts 0", () => {
      expect(validatePrimitive("unsignedInt", 0)).toBeNull();
    });

    it("accepts positive", () => {
      expect(validatePrimitive("unsignedInt", 42)).toBeNull();
    });

    it("rejects negative", () => {
      expect(validatePrimitive("unsignedInt", -1)).not.toBeNull();
    });

    it("rejects float", () => {
      expect(validatePrimitive("unsignedInt", 0.5)).not.toBeNull();
    });
  });

  describe("decimal", () => {
    it("accepts integer value", () => {
      expect(validatePrimitive("decimal", 42)).toBeNull();
    });

    it("accepts float", () => {
      expect(validatePrimitive("decimal", 3.14)).toBeNull();
    });

    it("accepts negative", () => {
      expect(validatePrimitive("decimal", -1.5)).toBeNull();
    });

    it("rejects string", () => {
      expect(validatePrimitive("decimal", "3.14")).not.toBeNull();
    });

    it("rejects Infinity", () => {
      expect(validatePrimitive("decimal", Infinity)).not.toBeNull();
    });

    it("rejects NaN", () => {
      expect(validatePrimitive("decimal", NaN)).not.toBeNull();
    });
  });

  describe("string / markdown / xhtml", () => {
    for (const type of ["string", "markdown", "xhtml"]) {
      it(`${type}: accepts string`, () => {
        expect(validatePrimitive(type, "hello")).toBeNull();
      });

      it(`${type}: accepts empty string`, () => {
        expect(validatePrimitive(type, "")).toBeNull();
      });

      it(`${type}: rejects number`, () => {
        expect(validatePrimitive(type, 123)).not.toBeNull();
      });
    }
  });

  describe("code", () => {
    it("accepts non-empty code", () => {
      expect(validatePrimitive("code", "active")).toBeNull();
    });

    it("rejects empty string", () => {
      expect(validatePrimitive("code", "")).not.toBeNull();
    });

    it("rejects whitespace-only string", () => {
      expect(validatePrimitive("code", "   ")).not.toBeNull();
    });

    it("rejects number", () => {
      expect(validatePrimitive("code", 42)).not.toBeNull();
    });
  });

  describe("id", () => {
    it("accepts valid id", () => {
      expect(validatePrimitive("id", "example-123")).toBeNull();
    });

    it("accepts single character", () => {
      expect(validatePrimitive("id", "a")).toBeNull();
    });

    it("accepts dots and hyphens", () => {
      expect(validatePrimitive("id", "a.b-c")).toBeNull();
    });

    it("rejects empty string", () => {
      expect(validatePrimitive("id", "")).not.toBeNull();
    });

    it("rejects string over 64 chars", () => {
      expect(validatePrimitive("id", "a".repeat(65))).not.toBeNull();
    });

    it("rejects special characters", () => {
      expect(validatePrimitive("id", "abc@def")).not.toBeNull();
    });
  });

  describe("uri / url / canonical", () => {
    for (const type of ["uri", "url", "canonical"]) {
      it(`${type}: accepts URL string`, () => {
        expect(validatePrimitive(type, "http://example.com")).toBeNull();
      });

      it(`${type}: accepts URN`, () => {
        expect(validatePrimitive(type, "urn:oid:1.2.3")).toBeNull();
      });

      it(`${type}: rejects number`, () => {
        expect(validatePrimitive(type, 123)).not.toBeNull();
      });
    }
  });

  describe("oid", () => {
    it("accepts valid oid", () => {
      expect(validatePrimitive("oid", "urn:oid:1.2.3.4")).toBeNull();
    });

    it("accepts oid starting with 2", () => {
      expect(validatePrimitive("oid", "urn:oid:2.16.840")).toBeNull();
    });

    it("rejects without urn:oid prefix", () => {
      expect(validatePrimitive("oid", "1.2.3.4")).not.toBeNull();
    });

    it("rejects invalid oid", () => {
      expect(validatePrimitive("oid", "urn:oid:abc")).not.toBeNull();
    });
  });

  describe("uuid", () => {
    it("accepts valid uuid", () => {
      expect(validatePrimitive("uuid", "urn:uuid:550e8400-e29b-41d4-a716-446655440000")).toBeNull();
    });

    it("rejects without urn:uuid prefix", () => {
      expect(validatePrimitive("uuid", "550e8400-e29b-41d4-a716-446655440000")).not.toBeNull();
    });

    it("rejects invalid uuid", () => {
      expect(validatePrimitive("uuid", "urn:uuid:not-a-uuid")).not.toBeNull();
    });
  });

  describe("date", () => {
    it("accepts YYYY", () => {
      expect(validatePrimitive("date", "2024")).toBeNull();
    });

    it("accepts YYYY-MM", () => {
      expect(validatePrimitive("date", "2024-01")).toBeNull();
    });

    it("accepts YYYY-MM-DD", () => {
      expect(validatePrimitive("date", "2024-01-15")).toBeNull();
    });

    it("rejects date with time", () => {
      expect(validatePrimitive("date", "2024-01-15T10:00:00")).not.toBeNull();
    });

    it("rejects invalid format", () => {
      expect(validatePrimitive("date", "01/15/2024")).not.toBeNull();
    });
  });

  describe("dateTime", () => {
    it("accepts date only", () => {
      expect(validatePrimitive("dateTime", "2024")).toBeNull();
    });

    it("accepts YYYY-MM", () => {
      expect(validatePrimitive("dateTime", "2024-06")).toBeNull();
    });

    it("accepts full dateTime with Z", () => {
      expect(validatePrimitive("dateTime", "2024-01-15T10:30:00Z")).toBeNull();
    });

    it("accepts dateTime with timezone offset", () => {
      expect(validatePrimitive("dateTime", "2024-01-15T10:30:00+05:00")).toBeNull();
    });

    it("accepts dateTime with milliseconds", () => {
      expect(validatePrimitive("dateTime", "2024-01-15T10:30:00.123Z")).toBeNull();
    });

    it("rejects invalid format", () => {
      expect(validatePrimitive("dateTime", "not-a-date")).not.toBeNull();
    });
  });

  describe("instant", () => {
    it("accepts full instant with Z", () => {
      expect(validatePrimitive("instant", "2024-01-15T10:30:00Z")).toBeNull();
    });

    it("accepts instant with offset", () => {
      expect(validatePrimitive("instant", "2024-01-15T10:30:00+05:00")).toBeNull();
    });

    it("accepts instant with milliseconds", () => {
      expect(validatePrimitive("instant", "2024-01-15T10:30:00.123Z")).toBeNull();
    });

    it("rejects date only", () => {
      expect(validatePrimitive("instant", "2024-01-15")).not.toBeNull();
    });

    it("rejects without timezone", () => {
      expect(validatePrimitive("instant", "2024-01-15T10:30:00")).not.toBeNull();
    });
  });

  describe("time", () => {
    it("accepts HH:MM", () => {
      expect(validatePrimitive("time", "10:30")).toBeNull();
    });

    it("accepts HH:MM:SS", () => {
      expect(validatePrimitive("time", "10:30:45")).toBeNull();
    });

    it("accepts HH:MM:SS.sss", () => {
      expect(validatePrimitive("time", "10:30:45.123")).toBeNull();
    });

    it("rejects invalid format", () => {
      expect(validatePrimitive("time", "10am")).not.toBeNull();
    });
  });

  describe("base64Binary", () => {
    it("accepts valid base64", () => {
      expect(validatePrimitive("base64Binary", "SGVsbG8=")).toBeNull();
    });

    it("accepts empty string", () => {
      expect(validatePrimitive("base64Binary", "")).toBeNull();
    });

    it("rejects invalid characters", () => {
      expect(validatePrimitive("base64Binary", "not valid!@#")).not.toBeNull();
    });

    it("rejects non-string", () => {
      expect(validatePrimitive("base64Binary", 123)).not.toBeNull();
    });
  });

  describe("unknown type", () => {
    it("returns null for unknown type codes", () => {
      expect(validatePrimitive("UnknownType", "anything")).toBeNull();
    });
  });
});
