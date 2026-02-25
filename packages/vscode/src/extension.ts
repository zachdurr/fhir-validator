import * as path from "node:path";
import {
  workspace,
  window,
  commands,
  StatusBarAlignment,
  type ExtensionContext,
  type StatusBarItem,
  type TextEditor,
} from "vscode";
import {
  LanguageClient,
  type LanguageClientOptions,
  type ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

let client: LanguageClient;
let statusBarItem: StatusBarItem;

export function activate(context: ExtensionContext): void {
  const serverModule = context.asAbsolutePath(path.join("dist", "server.js"));

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { language: "fhir-json" },
      { language: "json", scheme: "file" },
      { language: "json", scheme: "untitled" },
    ],
    synchronize: {
      configurationSection: "fhir-validate",
    },
  };

  client = new LanguageClient("fhirValidate", "FHIR Validate", serverOptions, clientOptions);

  // Status bar
  statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 100);
  statusBarItem.command = "fhir-validate.showResourceInfo";
  context.subscriptions.push(statusBarItem);

  // Update status bar on active editor change
  context.subscriptions.push(window.onDidChangeActiveTextEditor(updateStatusBar));
  context.subscriptions.push(
    workspace.onDidChangeTextDocument((e) => {
      if (window.activeTextEditor?.document === e.document) {
        updateStatusBar(window.activeTextEditor);
      }
    }),
  );

  // Commands
  context.subscriptions.push(
    commands.registerCommand("fhir-validate.validateDocument", () => {
      const editor = window.activeTextEditor;
      if (editor) {
        client.sendNotification("fhir-validate/forceValidate", {
          uri: editor.document.uri.toString(),
        });
      }
    }),
  );

  context.subscriptions.push(
    commands.registerCommand("fhir-validate.showResourceInfo", () => {
      const editor = window.activeTextEditor;
      if (!editor) {
        window.showInformationMessage("No active editor");
        return;
      }
      const resourceType = extractResourceType(editor.document.getText());
      if (resourceType) {
        window.showInformationMessage(`FHIR Resource: ${resourceType}`);
      } else {
        window.showInformationMessage("Not a FHIR resource");
      }
    }),
  );

  client.start();

  // Initial status bar update
  updateStatusBar(window.activeTextEditor);
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}

function updateStatusBar(editor: TextEditor | undefined): void {
  if (!editor) {
    statusBarItem.hide();
    return;
  }

  const lang = editor.document.languageId;
  if (lang !== "json" && lang !== "fhir-json") {
    statusBarItem.hide();
    return;
  }

  const resourceType = extractResourceType(editor.document.getText());
  if (resourceType) {
    statusBarItem.text = `FHIR: ${resourceType}`;
    statusBarItem.show();
  } else {
    statusBarItem.hide();
  }
}

/**
 * Fast regex extraction of resourceType from JSON text.
 * Avoids parsing the entire document for status bar updates.
 */
function extractResourceType(text: string): string | undefined {
  const match = text.match(/"resourceType"\s*:\s*"([A-Za-z]+)"/);
  return match?.[1];
}
