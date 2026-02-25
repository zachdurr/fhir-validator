import type { FileResult } from "../types.js";

interface JsonIssue {
  severity: string;
  path: string;
  message: string;
  code: string;
  line: number;
  column: number;
  details?: string;
  url?: string;
}

interface JsonFileResult {
  file: string;
  valid: boolean;
  parseError?: string;
  issues: JsonIssue[];
}

export function formatJson(results: FileResult[]): string {
  const output: JsonFileResult[] = results.map((result) => {
    const entry: JsonFileResult = {
      file: result.file,
      valid: result.valid,
      issues: result.issues.map(({ issue, position }) => {
        const jsonIssue: JsonIssue = {
          severity: issue.severity,
          path: issue.path,
          message: issue.message,
          code: issue.code,
          // 1-based positions
          line: position ? position.line + 1 : 0,
          column: position ? position.startChar + 1 : 0,
        };
        if (issue.details) jsonIssue.details = issue.details;
        if (issue.url) jsonIssue.url = issue.url;
        return jsonIssue;
      }),
    };
    if (result.parseError) entry.parseError = result.parseError;
    return entry;
  });

  return JSON.stringify(output, null, 2);
}
