import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { DefinitionLoader } from "../../loader/DefinitionLoader.js";

const FIXTURE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "test-definitions.json",
);

describe("DefinitionLoader", () => {
  describe("getResourceDefinition", () => {
    it("returns a resource StructureDefinition by type", () => {
      const loader = new DefinitionLoader(FIXTURE_PATH);
      const sd = loader.getResourceDefinition("TestPatient");
      expect(sd).toBeDefined();
      expect(sd!.id).toBe("TestPatient");
      expect(sd!.kind).toBe("resource");
      expect(sd!.type).toBe("TestPatient");
    });

    it("returns undefined for unknown resource type", () => {
      const loader = new DefinitionLoader(FIXTURE_PATH);
      expect(loader.getResourceDefinition("NonExistent")).toBeUndefined();
    });

    it("does not return data types via resource lookup", () => {
      const loader = new DefinitionLoader(FIXTURE_PATH);
      expect(loader.getResourceDefinition("TestString")).toBeUndefined();
    });
  });

  describe("getTypeDefinition", () => {
    it("returns a primitive-type StructureDefinition", () => {
      const loader = new DefinitionLoader(FIXTURE_PATH);
      const sd = loader.getTypeDefinition("TestString");
      expect(sd).toBeDefined();
      expect(sd!.kind).toBe("primitive-type");
    });

    it("returns a complex-type StructureDefinition", () => {
      const loader = new DefinitionLoader(FIXTURE_PATH);
      const sd = loader.getTypeDefinition("TestQuantity");
      expect(sd).toBeDefined();
      expect(sd!.kind).toBe("complex-type");
    });

    it("returns undefined for unknown type", () => {
      const loader = new DefinitionLoader(FIXTURE_PATH);
      expect(loader.getTypeDefinition("NonExistent")).toBeUndefined();
    });

    it("does not return resources via type lookup", () => {
      const loader = new DefinitionLoader(FIXTURE_PATH);
      expect(loader.getTypeDefinition("TestPatient")).toBeUndefined();
    });
  });

  describe("getDefinitionByUrl", () => {
    it("returns a StructureDefinition by canonical URL", () => {
      const loader = new DefinitionLoader(FIXTURE_PATH);
      const sd = loader.getDefinitionByUrl(
        "http://test.fhir.org/StructureDefinition/TestPatient",
      );
      expect(sd).toBeDefined();
      expect(sd!.id).toBe("TestPatient");
    });

    it("returns undefined for unknown URL", () => {
      const loader = new DefinitionLoader(FIXTURE_PATH);
      expect(
        loader.getDefinitionByUrl("http://unknown.org/StructureDefinition/Nope"),
      ).toBeUndefined();
    });
  });

  describe("getElementDefinitions", () => {
    it("returns element definitions for a known resource", () => {
      const loader = new DefinitionLoader(FIXTURE_PATH);
      const elements = loader.getElementDefinitions("TestPatient");
      expect(elements).toHaveLength(3);
      expect(elements[0].path).toBe("TestPatient");
      expect(elements[1].path).toBe("TestPatient.name");
      expect(elements[2].path).toBe("TestPatient.active");
    });

    it("returns empty array for unknown resource", () => {
      const loader = new DefinitionLoader(FIXTURE_PATH);
      expect(loader.getElementDefinitions("NonExistent")).toEqual([]);
    });
  });

  describe("lazy loading", () => {
    it("does not load definitions until first method call", () => {
      // Construction should not throw even with a bad path
      const loader = new DefinitionLoader("/nonexistent/path.json");
      expect(loader).toBeDefined();

      // Accessing data should throw because the file doesn't exist
      expect(() => loader.getResourceDefinition("Patient")).toThrow();
    });

    it("caches after first load (same instance returns same data)", () => {
      const loader = new DefinitionLoader(FIXTURE_PATH);
      const first = loader.getResourceDefinition("TestPatient");
      const second = loader.getResourceDefinition("TestPatient");
      expect(first).toBe(second); // Same reference, not just equal
    });
  });
});
