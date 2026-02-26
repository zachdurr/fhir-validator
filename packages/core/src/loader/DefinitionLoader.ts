import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { DefinitionIndex, ElementDefinition, StructureDefinition } from "./types.js";
import type { FhirVersion } from "../types.js";
import { DEFAULT_FHIR_VERSION } from "../types.js";

function defaultPathForVersion(version: FhirVersion): string {
  const filename = `${version.toLowerCase()}-definitions.json`;
  const thisDir = dirname(fileURLToPath(import.meta.url));

  // From source (src/loader/): ../../definitions/<file>
  // From dist (dist/):          ../definitions/<file>
  const fromSource = resolve(thisDir, "..", "..", "definitions", filename);
  if (existsSync(fromSource)) return fromSource;
  return resolve(thisDir, "..", "definitions", filename);
}

export interface DefinitionLoaderOptions {
  version?: FhirVersion;
  definitionsPath?: string;
}

export class DefinitionLoader {
  private index: DefinitionIndex | null = null;
  private readonly definitionsPath: string;
  public readonly version: FhirVersion;

  constructor(pathOrOptions?: string | DefinitionLoaderOptions) {
    if (typeof pathOrOptions === "string") {
      this.version = DEFAULT_FHIR_VERSION;
      this.definitionsPath = pathOrOptions;
    } else {
      this.version = pathOrOptions?.version ?? DEFAULT_FHIR_VERSION;
      this.definitionsPath = pathOrOptions?.definitionsPath ?? defaultPathForVersion(this.version);
    }
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
