import * as esbuild from "esbuild";
import { copyFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const shared = {
  bundle: true,
  platform: "node",
  target: "node18",
  sourcemap: true,
  minify: false,
  logLevel: "info",
};

// Extension client — runs in the VSCode extension host
await esbuild.build({
  ...shared,
  entryPoints: ["src/extension.ts"],
  outfile: "dist/extension.js",
  format: "cjs",
  external: ["vscode"],
});

// Language server — runs as a separate process
await esbuild.build({
  ...shared,
  entryPoints: ["src/server.ts"],
  outfile: "dist/server.js",
  format: "cjs",
});

// Copy r4-definitions.json into dist/ so the server can load it at runtime.
// The CJS bundle shims import.meta.url as {}, so DefinitionLoader's default
// path resolution fails. We must pass an explicit definitionsPath.
const definitionsSrc = resolve(__dirname, "..", "core", "definitions", "r4-definitions.json");
const definitionsDest = resolve(__dirname, "dist", "r4-definitions.json");

if (existsSync(definitionsSrc)) {
  copyFileSync(definitionsSrc, definitionsDest);
  console.log("✓ Copied r4-definitions.json to dist/");
} else {
  console.warn("⚠ r4-definitions.json not found — run `pnpm --filter @fhir-validate/core build:definitions` first");
}
