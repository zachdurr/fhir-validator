export interface ValidationIssue {
  severity: "error" | "warning" | "info";
  path: string;
  message: string;
  code: string;
  details?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface ValidateOptions {
  profile?: string;
  version?: "R4";
}
