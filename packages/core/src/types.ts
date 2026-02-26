export type FhirVersion = "R4" | "R5";

export const DEFAULT_FHIR_VERSION: FhirVersion = "R4";

export const FHIR_BASE_URLS: Record<FhirVersion, string> = {
  R4: "https://hl7.org/fhir/R4",
  R5: "https://hl7.org/fhir/R5",
};

export interface ValidationIssue {
  severity: "error" | "warning" | "info";
  path: string;
  message: string;
  code: string;
  details?: string;
  url?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface ValidateOptions {
  profile?: string;
  version?: FhirVersion;
}
