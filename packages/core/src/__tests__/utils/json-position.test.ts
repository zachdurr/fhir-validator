import { describe, it, expect } from "vitest";
import { resolveJsonPosition } from "../../utils/json-position";

describe("resolveJsonPosition", () => {
  describe("empty path", () => {
    it("returns root position for empty string", () => {
      const json = `{"resourceType": "Patient"}`;
      const pos = resolveJsonPosition(json, "");
      expect(pos).toEqual({ line: 0, startChar: 0, endChar: 1 });
    });
  });

  describe("resourceType path (no dot)", () => {
    it("resolves resourceType at root", () => {
      const json = `{
  "resourceType": "Patient",
  "id": "123"
}`;
      const pos = resolveJsonPosition(json, "resourceType");
      expect(pos).toBeDefined();
      expect(pos!.line).toBe(1);
      // "Patient" starts at the quote
      expect(pos!.startChar).toBe(18);
    });
  });

  describe("root-level properties", () => {
    it("resolves a root-level string value", () => {
      const json = `{
  "resourceType": "Patient",
  "id": "abc-123"
}`;
      const pos = resolveJsonPosition(json, "Patient.id");
      expect(pos).toBeDefined();
      expect(pos!.line).toBe(2);
    });

    it("resolves a root-level boolean value", () => {
      const json = `{
  "resourceType": "Patient",
  "active": true
}`;
      const pos = resolveJsonPosition(json, "Patient.active");
      expect(pos).toBeDefined();
      expect(pos!.line).toBe(2);
    });

    it("resolves a root-level number value", () => {
      const json = `{
  "resourceType": "Observation",
  "status": "final",
  "valueInteger": 42
}`;
      const pos = resolveJsonPosition(json, "Observation.valueInteger");
      expect(pos).toBeDefined();
      expect(pos!.line).toBe(3);
    });

    it("resolves a null value", () => {
      const json = `{
  "resourceType": "Patient",
  "active": null
}`;
      const pos = resolveJsonPosition(json, "Patient.active");
      expect(pos).toBeDefined();
      expect(pos!.line).toBe(2);
    });
  });

  describe("nested object paths", () => {
    it("resolves a value in a nested object", () => {
      const json = `{
  "resourceType": "Patient",
  "name": [
    {
      "family": "Smith",
      "given": ["John"]
    }
  ]
}`;
      const pos = resolveJsonPosition(json, "Patient.name[0].family");
      expect(pos).toBeDefined();
      expect(pos!.line).toBe(4);
    });

    it("resolves the array element itself", () => {
      const json = `{
  "resourceType": "Patient",
  "name": [
    {
      "family": "Smith"
    }
  ]
}`;
      const pos = resolveJsonPosition(json, "Patient.name[0]");
      expect(pos).toBeDefined();
      expect(pos!.line).toBe(3);
    });
  });

  describe("array index resolution", () => {
    it("resolves second element in array", () => {
      const json = `{
  "resourceType": "Patient",
  "name": [
    {
      "family": "Smith"
    },
    {
      "family": "Jones"
    }
  ]
}`;
      const pos = resolveJsonPosition(json, "Patient.name[1].family");
      expect(pos).toBeDefined();
      expect(pos!.line).toBe(7);
    });

    it("resolves primitive array elements", () => {
      const json = `{
  "resourceType": "Patient",
  "name": [
    {
      "given": ["John", "James"]
    }
  ]
}`;
      const pos = resolveJsonPosition(json, "Patient.name[0].given");
      expect(pos).toBeDefined();
      expect(pos!.line).toBe(4);
    });
  });

  describe("non-existent paths", () => {
    it("returns undefined for missing property", () => {
      const json = `{
  "resourceType": "Patient",
  "id": "123"
}`;
      const pos = resolveJsonPosition(json, "Patient.nonexistent");
      expect(pos).toBeUndefined();
    });

    it("returns undefined for missing array index", () => {
      const json = `{
  "resourceType": "Patient",
  "name": [{"family": "Smith"}]
}`;
      const pos = resolveJsonPosition(json, "Patient.name[5]");
      expect(pos).toBeUndefined();
    });

    it("returns undefined for path into non-object", () => {
      const json = `{
  "resourceType": "Patient",
  "active": true
}`;
      const pos = resolveJsonPosition(json, "Patient.active.something");
      expect(pos).toBeUndefined();
    });
  });

  describe("escaped strings", () => {
    it("handles escaped quotes in key names", () => {
      // This is unusual in FHIR but tests robustness
      const json = `{
  "resourceType": "Patient",
  "id": "has\\"quote"
}`;
      const pos = resolveJsonPosition(json, "Patient.id");
      expect(pos).toBeDefined();
      expect(pos!.line).toBe(2);
    });

    it("handles escaped quotes in values before target", () => {
      const json = `{
  "resourceType": "Patient",
  "text": "some \\"text\\" here",
  "id": "123"
}`;
      const pos = resolveJsonPosition(json, "Patient.id");
      expect(pos).toBeDefined();
      expect(pos!.line).toBe(3);
    });
  });

  describe("character positions", () => {
    it("captures correct start and end for a string value", () => {
      const json = `{"id": "abc"}`;
      const pos = resolveJsonPosition(json, "id");
      expect(pos).toBeDefined();
      expect(pos!.line).toBe(0);
      expect(pos!.startChar).toBe(7);
      expect(pos!.endChar).toBe(12);
    });

    it("captures correct start and end for a number value", () => {
      const json = `{"count": 42}`;
      const pos = resolveJsonPosition(json, "count");
      expect(pos).toBeDefined();
      expect(pos!.line).toBe(0);
      expect(pos!.startChar).toBe(10);
      expect(pos!.endChar).toBe(12);
    });

    it("captures correct start and end for boolean", () => {
      const json = `{"active": false}`;
      const pos = resolveJsonPosition(json, "active");
      expect(pos).toBeDefined();
      expect(pos!.line).toBe(0);
      expect(pos!.startChar).toBe(11);
      expect(pos!.endChar).toBe(16);
    });
  });

  describe("deeply nested paths", () => {
    it("resolves three levels deep", () => {
      const json = `{
  "resourceType": "Patient",
  "contact": [
    {
      "name": {
        "family": "Guardian"
      }
    }
  ]
}`;
      const pos = resolveJsonPosition(json, "Patient.contact[0].name.family");
      expect(pos).toBeDefined();
      expect(pos!.line).toBe(5);
    });
  });
});
