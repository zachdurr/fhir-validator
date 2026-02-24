import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type {
  StructureDefinition,
  ElementDefinition,
  DefinitionIndex,
} from "../src/loader/types.js";

const BASE_URL = "https://hl7.org/fhir/R4";
const ROOT = join(import.meta.dirname, "..");
const RAW_DIR = join(ROOT, "definitions", "raw");
const OUTPUT_PATH = join(ROOT, "definitions", "r4-definitions.json");

const FILES_TO_DOWNLOAD = [
  { name: "profiles-resources.json", extract: true },
  { name: "profiles-types.json", extract: true },
  { name: "valuesets.json", extract: false },
] as const;

async function fetchWithRetry(
  url: string,
  retries = 3,
  delayMs = 1000,
): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`  Fetching ${url} (attempt ${attempt}/${retries})...`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response;
    } catch (error) {
      if (attempt === retries) throw error;
      const wait = delayMs * Math.pow(2, attempt - 1);
      console.log(`  Retrying in ${wait}ms...`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw new Error("Unreachable");
}

function trimElementDefinition(el: Record<string, unknown>): ElementDefinition {
  const trimmed: ElementDefinition = { path: el.path as string };

  if (el.id !== undefined) trimmed.id = el.id as string;
  if (el.min !== undefined) trimmed.min = el.min as number;
  if (el.max !== undefined) trimmed.max = el.max as string;
  if (el.short !== undefined) trimmed.short = el.short as string;
  if (el.definition !== undefined) trimmed.definition = el.definition as string;
  if (el.mustSupport !== undefined) trimmed.mustSupport = el.mustSupport as boolean;

  if (el.type !== undefined) {
    trimmed.type = (el.type as Record<string, unknown>[]).map((t) => {
      const tt: Record<string, unknown> = { code: t.code };
      if (t.targetProfile !== undefined) tt.targetProfile = t.targetProfile;
      if (t.profile !== undefined) tt.profile = t.profile;
      return tt as ElementDefinition["type"] extends (infer U)[] | undefined ? U : never;
    });
  }

  if (el.binding !== undefined) {
    const b = el.binding as Record<string, unknown>;
    const tb: Record<string, unknown> = { strength: b.strength };
    if (b.valueSet !== undefined) tb.valueSet = b.valueSet;
    trimmed.binding = tb as ElementDefinition["binding"];
  }

  if (el.constraint !== undefined) {
    trimmed.constraint = (el.constraint as Record<string, unknown>[]).map((c) => {
      const tc: Record<string, unknown> = {
        key: c.key,
        severity: c.severity,
        human: c.human,
      };
      if (c.expression !== undefined) tc.expression = c.expression;
      return tc as NonNullable<ElementDefinition["constraint"]>[number];
    });
  }

  return trimmed;
}

function trimStructureDefinition(
  sd: Record<string, unknown>,
): StructureDefinition {
  const trimmed: Record<string, unknown> = {
    id: sd.id,
    url: sd.url,
    name: sd.name,
    type: sd.type,
    kind: sd.kind,
    abstract: sd.abstract,
  };

  if (sd.baseDefinition !== undefined) trimmed.baseDefinition = sd.baseDefinition;
  if (sd.derivation !== undefined) trimmed.derivation = sd.derivation;

  if (sd.snapshot !== undefined) {
    const snapshot = sd.snapshot as { element: Record<string, unknown>[] };
    trimmed.snapshot = {
      element: snapshot.element.map(trimElementDefinition),
    };
  }

  return trimmed as unknown as StructureDefinition;
}

interface FhirBundle {
  resourceType: "Bundle";
  entry?: Array<{ resource?: Record<string, unknown> }>;
}

function validateBundle(data: unknown, filename: string): FhirBundle {
  if (typeof data !== "object" || data === null) {
    throw new Error(`${filename}: Expected object, got ${typeof data}`);
  }
  const obj = data as Record<string, unknown>;
  if (obj.resourceType !== "Bundle") {
    throw new Error(
      `${filename}: Expected resourceType "Bundle", got "${obj.resourceType}"`,
    );
  }
  if (!Array.isArray(obj.entry)) {
    throw new Error(`${filename}: Missing or invalid "entry" array`);
  }
  return obj as unknown as FhirBundle;
}

async function main() {
  console.log("FHIR R4 Definition Downloader\n");

  // Ensure directories exist
  mkdirSync(RAW_DIR, { recursive: true });
  mkdirSync(join(ROOT, "definitions"), { recursive: true });

  // Download files
  const rawContents = new Map<string, string>();
  for (const file of FILES_TO_DOWNLOAD) {
    const url = `${BASE_URL}/${file.name}`;
    const response = await fetchWithRetry(url);
    const text = await response.text();
    const outPath = join(RAW_DIR, file.name);
    writeFileSync(outPath, text, "utf-8");
    console.log(`  Saved ${file.name} (${(text.length / 1024 / 1024).toFixed(1)}MB)`);
    if (file.extract) {
      rawContents.set(file.name, text);
    }
  }

  console.log("\nParsing and trimming StructureDefinitions...");

  // Extract and trim StructureDefinitions
  const allDefinitions: StructureDefinition[] = [];
  const resources: Record<string, number> = {};
  const types: Record<string, number> = {};
  const byUrl: Record<string, number> = {};

  for (const [filename, text] of rawContents) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`Failed to parse JSON from ${filename}`);
    }

    const bundle = validateBundle(parsed, filename);
    let count = 0;

    for (const entry of bundle.entry ?? []) {
      const resource = entry.resource;
      if (!resource || resource.resourceType !== "StructureDefinition") continue;

      const trimmed = trimStructureDefinition(resource);
      const index = allDefinitions.length;
      allDefinitions.push(trimmed);

      // Build lookup maps
      byUrl[trimmed.url] = index;

      if (trimmed.kind === "resource") {
        resources[trimmed.type] = index;
      } else if (
        trimmed.kind === "primitive-type" ||
        trimmed.kind === "complex-type"
      ) {
        types[trimmed.type] = index;
      }

      count++;
    }

    console.log(`  ${filename}: extracted ${count} StructureDefinitions`);
  }

  // Build index
  const definitionIndex: DefinitionIndex = {
    definitions: allDefinitions,
    resources,
    types,
    byUrl,
  };

  // Write output
  const output = JSON.stringify(definitionIndex);
  writeFileSync(OUTPUT_PATH, output, "utf-8");
  const sizeMB = (output.length / 1024 / 1024).toFixed(1);

  console.log(`\nSummary:`);
  console.log(`  Total StructureDefinitions: ${allDefinitions.length}`);
  console.log(`  Resource types: ${Object.keys(resources).length}`);
  console.log(`  Data types: ${Object.keys(types).length}`);
  console.log(`  Output size: ${sizeMB}MB`);
  console.log(`  Written to: ${OUTPUT_PATH}`);

  // Verify we can read it back
  if (!existsSync(OUTPUT_PATH)) {
    throw new Error("Output file was not created!");
  }
  console.log("\nDone!");
}

main().catch((error) => {
  console.error("\nFatal error:", error);
  process.exit(1);
});
