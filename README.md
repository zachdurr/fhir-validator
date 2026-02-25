# fhir-validate

Offline, fast, TypeScript-native FHIR R4 structural validator. Available as a library, CLI tool, and VS Code extension.

- **Offline** — no network calls, bundled R4 definitions
- **Fast** — validates 100+ resources per second
- **TypeScript-native** — first-class types, zero runtime dependencies in core
- **Actionable errors** — error codes, did-you-mean suggestions, FHIR spec links

## Packages

| Package                                     | Description            | npm                           |
| ------------------------------------------- | ---------------------- | ----------------------------- |
| [`@fhir-validate/core`](./packages/core)    | Core validation engine | `npm i @fhir-validate/core`   |
| [`@fhir-validate/cli`](./packages/cli)      | Command-line interface | `npm i -g @fhir-validate/cli` |
| [`fhir-validate-vscode`](./packages/vscode) | VS Code extension      | Marketplace                   |

## Quick Start

### Library

```bash
npm install @fhir-validate/core
```

```typescript
import { StructureValidator, DefinitionLoader } from "@fhir-validate/core";

const loader = new DefinitionLoader();
const validator = new StructureValidator(loader);

const result = validator.validate({
  resourceType: "Patient",
  name: [{ family: "Smith", given: ["John"] }],
  birthDate: "1990-01-15",
  active: true,
});

if (result.valid) {
  console.log("Valid FHIR resource!");
} else {
  for (const issue of result.issues) {
    console.error(`${issue.path}: ${issue.message}`);
  }
}
```

### CLI

```bash
# Validate a single file
fhir-validate patient.json

# Validate multiple files with glob
fhir-validate "data/**/*.json"

# JSON output for CI pipelines
fhir-validate patient.json --format json

# SARIF output for GitHub Actions
fhir-validate "*.json" --format sarif > results.sarif

# Read from stdin
cat patient.json | fhir-validate --stdin

# Watch mode
fhir-validate "data/*.json" --watch
```

## CLI Usage

```
fhir-validate [files...] [options]

Arguments:
  files                  FHIR JSON files or glob patterns

Options:
  -f, --format <format>  Output format: text, json, sarif (default: "text")
  -s, --strict           Treat warnings as errors
  --severity <level>     Minimum severity to report: error, warning, info (default: "info")
  --quiet                Suppress summary line
  --max-issues <n>       Max issues per file, 0 = unlimited (default: 0)
  --stdin                Read JSON from stdin
  -w, --watch            Watch files for changes
  -V, --version          Show version
  -h, --help             Show help
```

### Exit Codes

| Code | Meaning                                               |
| ---- | ----------------------------------------------------- |
| `0`  | No validation errors                                  |
| `1`  | Validation errors found (or warnings with `--strict`) |
| `2`  | CLI usage error (bad arguments, no files matched)     |

## VS Code Extension

Install `fhir-validate-vscode` from the VS Code Marketplace.

**Features:**

- Real-time validation as you type (300ms debounce)
- Diagnostics with error codes, details, and FHIR spec links
- Status bar showing detected resource type (e.g., "FHIR: Patient")
- Auto-detection of `.fhir.json` files
- Works with any `.json` file containing a FHIR resource

**Settings:**

- `fhir-validate.enabled` — toggle validation on/off (default: `true`)
- `fhir-validate.severity.unknownProperties` — severity for unknown properties: `error`, `warning`, `info` (default: `warning`)

## Error Codes

| Code                    | Severity | Description                                                                         |
| ----------------------- | -------- | ----------------------------------------------------------------------------------- |
| `INVALID_RESOURCE`      | error    | Input is not a non-null JSON object                                                 |
| `MISSING_RESOURCE_TYPE` | error    | Missing `resourceType` field                                                        |
| `INVALID_RESOURCE_TYPE` | error    | `resourceType` is not a non-empty string                                            |
| `UNKNOWN_RESOURCE_TYPE` | error    | Resource type not in FHIR R4 (with did-you-mean suggestion)                         |
| `UNKNOWN_PROPERTY`      | error    | Property not defined on the resource type (with did-you-mean)                       |
| `REQUIRED_FIELD`        | error    | Required field missing, null, or empty array                                        |
| `CARDINALITY_ERROR`     | error    | Array where scalar expected, or scalar where array expected                         |
| `INVALID_TYPE`          | error    | Value doesn't match the expected FHIR primitive type                                |
| `CHOICE_TYPE_MULTIPLE`  | error    | Multiple choice type variants present (e.g., both `valueString` and `valueInteger`) |

## Comparison

| Feature             | fhir-validate | HAPI FHIR Validator | HL7 Validator               |
| ------------------- | ------------- | ------------------- | --------------------------- |
| Language            | TypeScript    | Java                | Java                        |
| Offline             | Yes           | Yes                 | Requires terminology server |
| Startup time        | ~50ms         | ~5s                 | ~10s                        |
| Installation        | `npm install` | Maven/JAR           | JAR download                |
| VS Code integration | Built-in      | No                  | No                          |

## Roadmap

- **Phase 1** (current): Structural validation — resource types, properties, cardinality, primitives, choice types
- **Phase 2**: Terminology binding validation — ValueSet membership, CodeSystem lookup
- **Phase 3**: FHIRPath constraint evaluation — invariant checking via FHIRPath expressions

## Development

```bash
# Prerequisites: Node.js 18+, pnpm 9+
pnpm install
pnpm build
pnpm test
pnpm typecheck
```

This is a Turborepo monorepo with pnpm workspaces. The `core` package builds first; `cli` and `vscode` build in parallel after.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, project structure, and PR guidelines.

## License

MIT
