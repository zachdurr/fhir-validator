import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { DefinitionIndex, ElementDefinition, StructureDefinition } from "./types.js";

const DEFAULT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "definitions",
  "r4-definitions.json",
);

export class DefinitionLoader {
  private index: DefinitionIndex | null = null;
  private readonly definitionsPath: string;

  constructor(definitionsPath?: string) {
    this.definitionsPath = definitionsPath ?? DEFAULT_PATH;
  }

  private ensureLoaded(): DefinitionIndex {
    if (this.index === null) {
      const raw = readFileSync(this.definitionsPath, "utf-8");
      this.index = JSON.parse(raw) as DefinitionIndex;
    }
    return this.index;
  }

  getResourceDefinition(resourceType: string): StructureDefinition | undefined {
    const index = this.ensureLoaded();
    const i = index.resources[resourceType];
    return i !== undefined ? index.definitions[i] : undefined;
  }

  getTypeDefinition(typeName: string): StructureDefinition | undefined {
    const index = this.ensureLoaded();
    const i = index.types[typeName];
    return i !== undefined ? index.definitions[i] : undefined;
  }

  getDefinitionByUrl(url: string): StructureDefinition | undefined {
    const index = this.ensureLoaded();
    const i = index.byUrl[url];
    return i !== undefined ? index.definitions[i] : undefined;
  }

  getResourceNames(): string[] {
    const index = this.ensureLoaded();
    return Object.keys(index.resources);
  }

  getElementDefinitions(resourceType: string): ElementDefinition[] {
    const sd = this.getResourceDefinition(resourceType);
    return sd?.snapshot?.element ?? [];
  }
}
