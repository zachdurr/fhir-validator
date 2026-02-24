import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  type InitializeResult,
  TextDocumentSyncKind,
  DiagnosticSeverity,
  type Diagnostic,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { validate, type ValidationIssue } from "@fhir-validate/core";

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

connection.onInitialize((): InitializeResult => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
    },
  };
});

documents.onDidChangeContent((change) => {
  validateDocument(change.document);
});

function validateDocument(document: TextDocument): void {
  const text = document.getText();
  const diagnostics: Diagnostic[] = [];

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

  const result = validate(resource);

  for (const issue of result.issues) {
    diagnostics.push({
      severity: mapSeverity(issue.severity),
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 1 },
      },
      message: issue.message,
      source: "fhir-validate",
      code: issue.code,
    });
  }

  connection.sendDiagnostics({ uri: document.uri, diagnostics });
}

function mapSeverity(severity: ValidationIssue["severity"]): DiagnosticSeverity {
  switch (severity) {
    case "error":
      return DiagnosticSeverity.Error;
    case "warning":
      return DiagnosticSeverity.Warning;
    case "info":
      return DiagnosticSeverity.Information;
  }
}

documents.listen(connection);
connection.listen();
