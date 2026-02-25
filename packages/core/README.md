# @fhir-validate/core

Core FHIR R4 structural validation engine. Offline, fast, TypeScript-native.

## Installation

```bash
npm install @fhir-validate/core
# or
pnpm add @fhir-validate/core
```

## Quick Start

```typescript
import { StructureValidator, DefinitionLoader } from "@fhir-validate/core";

// Load bundled FHIR R4 definitions
const loader = new DefinitionLoader();
const validator = new StructureValidator(loader);

const result = validator.validate({
  resourceType: "Patient",
  name: [{ family: "Smith", given: ["John"] }],
  active: true,
  birthDate: "1990-01-15",
});

console.log(result.valid); // true
console.log(result.issues); // []
```

## API Reference

### `validate(resource: unknown): ValidationResult`

Standalone validation function for basic resource checks (resourceType presence and format). For full structural validation, use `StructureValidator` instead.

```typescript
import { validate } from "@fhir-validate/core";

const result = validate({ resourceType: "Patient" });
// { valid: true, issues: [] }
```

### `StructureValidator`

Full structural validator. Checks properties, cardinality, types, required fields, choice types, and nested complex types.

```typescript
import { StructureValidator, DefinitionLoader } from "@fhir-validate/core";

const loader = new DefinitionLoader();
const validator = new StructureValidator(loader);

const result = validator.validate({
  resourceType: "Observation",
  status: "final",
  code: { coding: [{ system: "http://loinc.org", code: "85354-9" }] },
  valueQuantity: { value: 120, unit: "mmHg" },
});
```

### `DefinitionLoader`

Loads FHIR StructureDefinition resources. Without arguments, loads the bundled R4 definitions. Pass a file path to load custom/test definitions.

```typescript
// Bundled R4 definitions (all resource types)
const loader = new DefinitionLoader();

// Custom definitions (e.g., for testing)
const testLoader = new DefinitionLoader("/path/to/definitions.json");
```

### `MessageFormatter`

Generates structured error messages with FHIR spec links, did-you-mean suggestions, and format hints.

```typescript
import { MessageFormatter } from "@fhir-validate/core";

const formatter = new MessageFormatter();
const issue = formatter.formatRequiredField("status", {
  resourceType: "Observation",
  fhirPath: "Observation",
  jsonPath: "Observation",
});
// issue.message: 'Missing required field "status" (registered | preliminary | final | amended).'
// issue.url: 'https://hl7.org/fhir/R4/observation-definitions.html#Observation.status'
```

### `resolveJsonPosition(jsonText: string, fhirPath: string): JsonPosition | undefined`

Maps a FHIR path (e.g., `Patient.name[0].family`) to a line/column position in raw JSON text. Used by the VS Code extension and CLI for precise error locations.

```typescript
import { resolveJsonPosition } from "@fhir-validate/core";

const json = '{\n  "resourceType": "Patient",\n  "active": true\n}';
const pos = resolveJsonPosition(json, "Patient.active");
// { line: 2, startChar: 12, endChar: 16 }
```

## Error Codes

| Code                    | Severity | Description                  | Example trigger                        |
| ----------------------- | -------- | ---------------------------- | -------------------------------------- |
| `INVALID_RESOURCE`      | error    | Input is not a JSON object   | `validate(null)`, `validate("string")` |
| `MISSING_RESOURCE_TYPE` | error    | No `resourceType` field      | `validate({})`                         |
| `INVALID_RESOURCE_TYPE` | error    | `resourceType` not a string  | `validate({ resourceType: 123 })`      |
| `UNKNOWN_RESOURCE_TYPE` | error    | Type not in definitions      | `validate({ resourceType: "Fake" })`   |
| `UNKNOWN_PROPERTY`      | error    | Property not defined on type | `Patient.nmae` (suggests `name`)       |
| `REQUIRED_FIELD`        | error    | Required field missing/null  | `Observation` without `status`         |
| `CARDINALITY_ERROR`     | error    | Wrong cardinality            | `active: [true]` (max=1)               |
| `INVALID_TYPE`          | error    | Wrong primitive type         | `active: "true"` (expects boolean)     |
| `CHOICE_TYPE_MULTIPLE`  | error    | Multiple choice variants     | Both `valueString` and `valueInteger`  |

## Types

```typescript
interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

interface ValidationIssue {
  severity: "error" | "warning" | "info";
  path: string; // e.g., "Patient.name[0].family"
  message: string; // Human-readable error message
  code: string; // Machine-readable error code
  details?: string; // Extended explanation and guidance
  url?: string; // Link to relevant FHIR spec page
}

interface JsonPosition {
  line: number; // 0-based line number
  startChar: number; // 0-based start column
  endChar: number; // 0-based end column (exclusive)
}
```

## Testing with Custom Definitions

For testing, you can load a subset of definitions instead of the full R4 bundle:

```typescript
import { DefinitionLoader } from "@fhir-validate/core";
import { StructureValidator } from "@fhir-validate/core";

// Load test-specific definitions
const loader = new DefinitionLoader("./test-fixtures/definitions.json");
const validator = new StructureValidator(loader);

const result = validator.validate(myTestResource);
```

The definitions file format is a JSON object with `definitions` (array of StructureDefinition), `resources` (name→index map), `types` (name→index map), and `byUrl` (URL→index map).

## License

MIT
