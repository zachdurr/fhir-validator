# fhir-validate

A FHIR R4 resource validation library, CLI tool, and VSCode extension.

## Packages

| Package | Description |
|---------|-------------|
| `@fhir-validate/core` | Core validation engine for FHIR R4 resources |
| `@fhir-validate/cli` | Command-line interface for validating FHIR JSON files |
| `fhir-validate-vscode` | VSCode extension providing real-time FHIR validation diagnostics |

## Development

```bash
pnpm install
pnpm build
pnpm test
```

## Architecture

Turborepo monorepo with pnpm workspaces. The core package builds first; cli and vscode build in parallel after.
