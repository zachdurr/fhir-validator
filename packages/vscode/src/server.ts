import { resolve, dirname } from "node:path";
import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  type InitializeResult,
  TextDocumentSyncKind,
  DiagnosticSeverity,
  type Diagnostic,
  type TextDocumentChangeEvent,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  DefinitionLoader,
  StructureValidator,
  type ValidationIssue,
} from "@fhir-validate/core";
import { resolveJsonPosition } from "./utils/json-position";

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

interface FhirValidateSettings {
  enabled: boolean;
  severity: {
    unknownProperties: "error" | "warning" | "info";
  };
}

const defaultSettings: FhirValidateSettings = {
  enabled: true,
  severity: { unknownProperties: "warning" },
};

let globalSettings: FhirValidateSettings = { ...defaultSettings };

// ---------------------------------------------------------------------------
// Connection & documents
// ---------------------------------------------------------------------------

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

// ---------------------------------------------------------------------------
// Validator (lazy-init after connection starts)
// ---------------------------------------------------------------------------

let validator: StructureValidator | null = null;

function getValidator(): StructureValidator {
  if (validator === null) {
    // __dirname in the CJS bundle points to dist/
    const definitionsPath = resolve(dirname(__filename), "r4-definitions.json");
    const loader = new DefinitionLoader(definitionsPath);
    validator = new StructureValidator(loader);
  }
  return validator;
}

// ---------------------------------------------------------------------------
// Debounce per-document
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 300;
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleValidation(document: TextDocument): void {
  const uri = document.uri;
  const existing = debounceTimers.get(uri);
  if (existing !== undefined) {
    clearTimeout(existing);
  }
  debounceTimers.set(
    uri,
    setTimeout(() => {
      debounceTimers.delete(uri);
      validateDocument(document);
    }, DEBOUNCE_MS),
  );
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

connection.onInitialize((): InitializeResult => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
    },
  };
});

connection.onInitialized(() => {
  connection.onDidChangeConfiguration(({ settings }) => {
    globalSettings = mergeSettings(settings?.["fhir-validate"]);
    // Re-validate all open documents with new settings
    for (const doc of documents.all()) {
      validateDocument(doc);
    }
  });
});

documents.onDidChangeContent((change: TextDocumentChangeEvent<TextDocument>) => {
  if (globalSettings.enabled) {
    scheduleValidation(change.document);
  }
});

documents.onDidClose(({ document }) => {
  // Clean up debounce timer
  const timer = debounceTimers.get(document.uri);
  if (timer !== undefined) {
    clearTimeout(timer);
    debounceTimers.delete(document.uri);
  }
  // Clear diagnostics for closed document
  connection.sendDiagnostics({ uri: document.uri, diagnostics: [] });
});

// Custom notification: force validate (from command palette)
connection.onNotification("fhir-validate/forceValidate", (params: { uri: string }) => {
  const doc = documents.get(params.uri);
  if (doc) {
    validateDocument(doc);
  }
});

// ---------------------------------------------------------------------------
// Core validation
// ---------------------------------------------------------------------------

function validateDocument(document: TextDocument): void {
  if (!globalSettings.enabled) {
    connection.sendDiagnostics({ uri: document.uri, diagnostics: [] });
    return;
  }

  const text = document.getText();
  const diagnostics: Diagnostic[] = [];

  // Parse JSON
  let resource: unknown;
  try {
    resource = JSON.parse(text);
  } catch {
    diagnostics.push({
      severity: DiagnosticSeverity.Error,
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 1 },
      },
      message: "Invalid JSON",
      source: "fhir-validate",
    });
    connection.sendDiagnostics({ uri: document.uri, diagnostics });
    return;
  }

  // Skip non-FHIR JSON silently (no resourceType field)
  if (
    resource === null ||
    typeof resource !== "object" ||
    Array.isArray(resource) ||
    !("resourceType" in resource) ||
    typeof (resource as Record<string, unknown>).resourceType !== "string"
  ) {
    // Clear any stale diagnostics
    connection.sendDiagnostics({ uri: document.uri, diagnostics: [] });
    return;
  }

  // Run StructureValidator
  let result;
  try {
    result = getValidator().validate(resource);
  } catch {
    // If definitions aren't available, fall back silently
    connection.sendDiagnostics({ uri: document.uri, diagnostics: [] });
    return;
  }

  for (const issue of result.issues) {
    const pos = resolveJsonPosition(text, issue.path);
    const severity = mapSeverity(issue);

    const diagnostic: Diagnostic = {
      severity,
      range: pos
        ? {
            start: { line: pos.line, character: pos.startChar },
            end: { line: pos.line, character: pos.endChar },
          }
        : {
            // Fallback: first character of document
            start: { line: 0, character: 0 },
            end: { line: 0, character: 1 },
          },
      message: issue.message,
      source: "fhir-validate",
      code: issue.code,
    };

    // Clickable link to FHIR spec
    if (issue.url) {
      diagnostic.codeDescription = { href: issue.url };
    }

    // Extended details as related information
    if (issue.details) {
      diagnostic.relatedInformation = [
        {
          location: {
            uri: document.uri,
            range: diagnostic.range,
          },
          message: issue.details,
        },
      ];
    }

    diagnostics.push(diagnostic);
  }

  connection.sendDiagnostics({ uri: document.uri, diagnostics });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapSeverity(issue: ValidationIssue): DiagnosticSeverity {
  // Override unknown-property severity from settings
  if (issue.code === "UNKNOWN_PROPERTY") {
    return severityFromString(globalSettings.severity.unknownProperties);
  }
  return severityFromString(issue.severity);
}

function severityFromString(
  sev: "error" | "warning" | "info",
): DiagnosticSeverity {
  switch (sev) {
    case "error":
      return DiagnosticSeverity.Error;
    case "warning":
      return DiagnosticSeverity.Warning;
    case "info":
      return DiagnosticSeverity.Information;
  }
}

function mergeSettings(raw: Partial<FhirValidateSettings> | undefined): FhirValidateSettings {
  if (!raw) return { ...defaultSettings };
  return {
    enabled: raw.enabled ?? defaultSettings.enabled,
    severity: {
      unknownProperties:
        raw.severity?.unknownProperties ?? defaultSettings.severity.unknownProperties,
    },
  };
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

documents.listen(connection);
connection.listen();
