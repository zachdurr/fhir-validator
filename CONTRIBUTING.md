# Contributing to fhir-validate

## Prerequisites

- Node.js 18+
- pnpm 9+

## Development Setup

```bash
# Clone the repository
git clone <repo-url>
cd fhir-validate

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test

# Type-check all packages
pnpm typecheck
```

## Project Structure

```
fhir-validate/
├── packages/
│   ├── core/           # @fhir-validate/core — validation engine
│   │   ├── src/
│   │   │   ├── structure/    # StructureValidator, primitive validation
│   │   │   ├── loader/       # DefinitionLoader, FHIR type definitions
│   │   │   ├── messages/     # MessageFormatter, error code formatting
│   │   │   ├── utils/        # JSON position resolver, Levenshtein distance
│   │   │   └── __tests__/    # Unit + integration tests
│   │   └── definitions/      # Bundled FHIR R4 StructureDefinitions
│   │
│   ├── cli/            # @fhir-validate/cli — command-line tool
│   │   └── src/
│   │       ├── formatters/   # text, json, sarif output formatters
│   │       └── __tests__/
│   │
│   └── vscode/         # fhir-validate-vscode — VS Code extension
│       └── src/
│           ├── extension.ts  # Extension activation/deactivation
│           └── server.ts     # LSP language server
│
├── turbo.json          # Turborepo build pipeline config
└── pnpm-workspace.yaml
```

## Running Tests

```bash
# All packages
pnpm test

# Single package
pnpm --filter @fhir-validate/core test
pnpm --filter @fhir-validate/cli test
pnpm --filter fhir-validate-vscode test

# Type-check a single package
pnpm --filter @fhir-validate/core typecheck
```

## Adding a Validation Rule

1. **Add the check** in `packages/core/src/structure/StructureValidator.ts`

2. **Add the error message** in `packages/core/src/messages/MessageFormatter.ts`:
   - Create a `formatYourNewError(...)` method
   - Return a `ValidationIssue` with `severity`, `path`, `code`, `message`, `details`, and `url`
   - Use `findClosestMatch()` for did-you-mean suggestions where applicable

3. **Add the error code** constant — use SCREAMING_SNAKE_CASE (e.g., `REQUIRED_FIELD`, `INVALID_TYPE`)

4. **Write tests** in `packages/core/src/__tests__/structure/StructureValidator.test.ts`:

   ```typescript
   it("flags the new validation error", () => {
     const result = validator.validate({
       resourceType: "Patient",
       // ... resource triggering the error
     });
     expect(result.valid).toBe(false);
     expect(findIssue(result.issues, "YOUR_ERROR_CODE", "Patient.fieldName")).toBeDefined();
   });
   ```

5. **Run tests**: `pnpm --filter @fhir-validate/core test`

## Adding a New Resource Type to Test Fixtures

Test definitions live in `packages/core/src/__tests__/structure/fixtures/structure-definitions.json`. This is a subset of FHIR R4 used for fast, deterministic tests.

To add a resource type:

1. Add the StructureDefinition to the `definitions` array
2. Add the name→index mapping to `resources`
3. Add the URL→index mapping to `byUrl`
4. Add any new complex types to `types` and `byUrl`

## PR Guidelines

- **Branch naming**: `feat/description`, `fix/description`, `test/description`
- **Tests required**: All PRs must include tests for new functionality
- **Type-check**: Run `pnpm typecheck` before submitting
- **Commit messages**: Use concise, imperative style (e.g., "Add cardinality validation for arrays")
- **One concern per PR**: Keep PRs focused on a single change

## Architecture Notes

- `core` has zero runtime dependencies — keep it that way
- The `StructureValidator` uses the `DefinitionLoader` to look up types at runtime, not compile time
- The `MessageFormatter` is a separate class to keep validation logic clean and messages testable
- `id` and `extension` are universally allowed on all FHIR elements (not flagged as unknown)
- Properties prefixed with `_` (primitive extensions) are passed through without validation
