import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { FileResult } from "../types.js";

interface SarifResult {
  ruleId: string;
  level: "error" | "warning" | "note";
  message: { text: string };
  locations: Array<{
    physicalLocation: {
      artifactLocation: { uri: string };
      region: { startLine: number; startColumn: number; endColumn: number };
    };
  }>;
}

interface SarifRule {
  id: string;
  shortDescription: { text: string };
}

function mapLevel(severity: string): "error" | "warning" | "note" {
  switch (severity) {
    case "error":
      return "error";
    case "warning":
      return "warning";
    default:
      return "note";
  }
}

export function formatSarif(results: FileResult[]): string {
  const rulesMap = new Map<string, SarifRule>();
  const sarifResults: SarifResult[] = [];

  for (const result of results) {
    if (result.parseError) {
      const ruleId = "PARSE_ERROR";
      if (!rulesMap.has(ruleId)) {
        rulesMap.set(ruleId, {
          id: ruleId,
          shortDescription: { text: "JSON parse error" },
        });
      }
      const uri =
        result.filePath === "<stdin>"
          ? "stdin"
          : pathToFileURL(resolve(result.filePath)).href;
      sarifResults.push({
        ruleId,
        level: "error",
        message: { text: result.parseError },
        locations: [
          {
            physicalLocation: {
              artifactLocation: { uri },
              region: { startLine: 1, startColumn: 1, endColumn: 2 },
            },
          },
        ],
      });
      continue;
    }

    for (const { issue, position } of result.issues) {
      if (!rulesMap.has(issue.code)) {
        rulesMap.set(issue.code, {
          id: issue.code,
          shortDescription: { text: issue.code },
        });
      }

      const uri =
        result.filePath === "<stdin>"
          ? "stdin"
          : pathToFileURL(resolve(result.filePath)).href;

      sarifResults.push({
        ruleId: issue.code,
        level: mapLevel(issue.severity),
        message: { text: issue.message },
        locations: [
          {
            physicalLocation: {
              artifactLocation: { uri },
              region: {
                // SARIF uses 1-based positions
                startLine: position ? position.line + 1 : 1,
                startColumn: position ? position.startChar + 1 : 1,
                endColumn: position ? position.endChar + 1 : 2,
              },
            },
          },
        ],
      });
    }
  }

  const sarif = {
    $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json",
    version: "2.1.0" as const,
    runs: [
      {
        tool: {
          driver: {
            name: "fhir-validate",
            version: "0.1.0",
            informationUri: "https://github.com/fhir-validate/fhir-validate",
            rules: [...rulesMap.values()],
          },
        },
        results: sarifResults,
      },
    ],
  };

  return JSON.stringify(sarif, null, 2);
}
