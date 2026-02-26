import type { FhirVersion, ValidationIssue } from "../types.js";
import { DEFAULT_FHIR_VERSION, FHIR_BASE_URLS } from "../types.js";
import type { ElementDefinition } from "../loader/types.js";
import { findClosestMatch } from "../utils/levenshtein.js";

export interface PropertyContext {
  resourceType: string;
  fhirPath: string;
  jsonPath: string;
  elementDef?: ElementDefinition;
  validProperties?: string[];
}

/** Static map of common FHIR type examples. */
const TYPE_EXAMPLES: Record<string, string> = {
  HumanName: '{"family":"Smith","given":["John"]}',
  CodeableConcept: '{"coding":[{"system":"http://example.com","code":"abc"}],"text":"Example"}',
  Identifier: '{"system":"http://example.com","value":"12345"}',
  Reference: '{"reference":"Patient/123"}',
  Quantity: '{"value":120,"unit":"mmHg","system":"http://unitsofmeasure.org","code":"mm[Hg]"}',
  Period: '{"start":"2024-01-01","end":"2024-12-31"}',
  Coding: '{"system":"http://example.com","code":"abc","display":"Example"}',
  Address: '{"line":["123 Main St"],"city":"Springfield","state":"IL","postalCode":"62701"}',
  ContactPoint: '{"system":"phone","value":"555-1234","use":"home"}',
  Attachment: '{"contentType":"application/pdf","url":"http://example.com/doc.pdf"}',
  Meta: '{"versionId":"1","lastUpdated":"2024-01-01T00:00:00Z"}',
};

/** Primitive type format descriptions and examples. */
const PRIMITIVE_FORMAT: Record<string, { format: string; example: string }> = {
  boolean: { format: "true or false", example: "true" },
  integer: { format: "whole number (no decimals)", example: "42" },
  positiveInt: { format: "integer > 0", example: "1" },
  unsignedInt: { format: "integer >= 0", example: "0" },
  decimal: { format: "JSON number", example: "3.14" },
  string: { format: "JSON string", example: '"Hello"' },
  code: { format: "non-empty string (no leading/trailing whitespace)", example: '"active"' },
  id: { format: "alphanumeric, hyphens, dots (1-64 chars)", example: '"example-123"' },
  uri: { format: "URI string", example: '"http://example.com"' },
  url: { format: "URL string", example: '"https://example.com/fhir"' },
  canonical: { format: "canonical URL", example: '"http://hl7.org/fhir/ValueSet/example"' },
  oid: { format: "OID URN", example: '"urn:oid:2.16.840.1.113883"' },
  uuid: { format: "UUID URN", example: '"urn:uuid:c757873d-ec9a-4326-a141-556f43239520"' },
  date: { format: "YYYY, YYYY-MM, or YYYY-MM-DD", example: '"2024-01-15"' },
  dateTime: {
    format: "YYYY[-MM[-DD[THH:MM[:SS[.fff]][Z|+/-HH:MM]]]]",
    example: '"2024-01-15T10:30:00Z"',
  },
  instant: { format: "YYYY-MM-DDTHH:MM:SS[.fff]Z|+/-HH:MM", example: '"2024-01-15T10:30:00Z"' },
  time: { format: "HH:MM[:SS[.fff]]", example: '"13:30:00"' },
  base64Binary: { format: "base64-encoded string", example: '"SGVsbG8gV29ybGQ="' },
  markdown: { format: "markdown string", example: '"# Heading\\nParagraph text"' },
  xhtml: { format: "XHTML string", example: '"<div>content</div>"' },
};

export class MessageFormatter {
  private readonly fhirBase: string;
  private readonly versionLabel: string;

  constructor(version: FhirVersion = DEFAULT_FHIR_VERSION) {
    this.fhirBase = FHIR_BASE_URLS[version];
    this.versionLabel = version;
  }

  // ---------------------------------------------------------------------------
  // Resource-level issues
  // ---------------------------------------------------------------------------

  formatInvalidResource(input: unknown): ValidationIssue {
    const actualType = input === null ? "null" : Array.isArray(input) ? "array" : typeof input;

    return {
      severity: "error",
      path: "",
      code: "INVALID_RESOURCE",
      message: `Resource must be a non-null JSON object, but received ${actualType}.`,
      details:
        'A FHIR resource is a JSON object with at minimum a "resourceType" field. ' +
        `Example: {"resourceType":"Patient","name":[{"family":"Smith"}]}`,
      url: `${this.fhirBase}/resource.html`,
    };
  }

  formatMissingResourceType(): ValidationIssue {
    return {
      severity: "error",
      path: "",
      code: "MISSING_RESOURCE_TYPE",
      message: 'Resource is missing the required "resourceType" field.',
      details:
        'Every FHIR resource must include a "resourceType" string that identifies what kind ' +
        'of resource it is (e.g. "Patient", "Observation"). ' +
        'Add "resourceType": "<ResourceName>" to the root of your JSON object.',
      url: `${this.fhirBase}/resource.html#resource`,
    };
  }

  formatInvalidResourceType(value: unknown): ValidationIssue {
    return {
      severity: "error",
      path: "resourceType",
      code: "INVALID_RESOURCE_TYPE",
      message: `"resourceType" must be a non-empty string, but received ${typeof value === "string" ? "an empty/whitespace string" : typeof value}.`,
      details:
        'Set "resourceType" to a valid FHIR resource name such as "Patient", "Observation", or "MedicationRequest".',
      url: `${this.fhirBase}/resourcelist.html`,
    };
  }

  formatUnknownResourceType(name: string, knownTypes: string[]): ValidationIssue {
    const suggestion = findClosestMatch(name, knownTypes);
    const didYouMean = suggestion ? ` Did you mean "${suggestion}"?` : "";

    return {
      severity: "error",
      path: "resourceType",
      code: "UNKNOWN_RESOURCE_TYPE",
      message: `Unknown resource type "${name}".${didYouMean}`,
      details:
        `"${name}" is not a recognized FHIR ${this.versionLabel} resource type. ` +
        "See the FHIR resource list for all valid types.",
      url: `${this.fhirBase}/resourcelist.html`,
    };
  }

  // ---------------------------------------------------------------------------
  // Property-level issues
  // ---------------------------------------------------------------------------

  formatUnknownProperty(name: string, ctx: PropertyContext): ValidationIssue {
    const suggestion = ctx.validProperties
      ? findClosestMatch(name, ctx.validProperties)
      : undefined;
    const didYouMean = suggestion ? ` Did you mean "${suggestion}"?` : "";
    const validList =
      ctx.validProperties && ctx.validProperties.length > 0
        ? ` Valid properties include: ${ctx.validProperties.slice(0, 10).join(", ")}${ctx.validProperties.length > 10 ? `, ... (${ctx.validProperties.length} total)` : ""}.`
        : "";

    return {
      severity: "error",
      path: `${ctx.jsonPath}.${name}`,
      code: "UNKNOWN_PROPERTY",
      message: `Unknown property "${name}" on ${ctx.resourceType}.${didYouMean}`,
      details: `"${name}" is not a defined property of ${ctx.fhirPath}.${validList}`,
      url: this.generateDocUrl(ctx.resourceType, ctx.fhirPath),
    };
  }

  formatRequiredField(name: string, ctx: PropertyContext): ValidationIssue {
    const shortDesc = ctx.elementDef?.short ? ` (${ctx.elementDef.short})` : "";
    const minCard = ctx.elementDef?.min ?? 1;

    return {
      severity: "error",
      path: `${ctx.jsonPath}.${name}`,
      code: "REQUIRED_FIELD",
      message: `Missing required field "${name}"${shortDesc}.`,
      details: `"${ctx.fhirPath}.${name}" has a minimum cardinality of ${minCard} — it must be present and non-null.`,
      url: this.generateDocUrl(ctx.resourceType, `${ctx.fhirPath}.${name}`),
    };
  }

  formatRequiredFieldEmptyArray(name: string, ctx: PropertyContext): ValidationIssue {
    const shortDesc = ctx.elementDef?.short ? ` (${ctx.elementDef.short})` : "";

    return {
      severity: "error",
      path: `${ctx.jsonPath}.${name}`,
      code: "REQUIRED_FIELD",
      message: `Required field "${name}" must not be an empty array${shortDesc}.`,
      details: `"${ctx.fhirPath}.${name}" is required — an empty array [] does not satisfy the minimum cardinality of ${ctx.elementDef?.min ?? 1}. Provide at least one element.`,
      url: this.generateDocUrl(ctx.resourceType, `${ctx.fhirPath}.${name}`),
    };
  }

  formatRequiredChoiceType(
    base: string,
    variants: { concrete: string; typeCode: string }[],
    ctx: PropertyContext,
  ): ValidationIssue {
    const variantList = variants.map((v) => v.concrete).join(", ");

    return {
      severity: "error",
      path: `${ctx.jsonPath}.${base}[x]`,
      code: "REQUIRED_FIELD",
      message: `Required choice type "${base}[x]" must have at least one variant present.`,
      details:
        `Provide exactly one of: ${variantList}. ` +
        `Choice types in FHIR use a suffix indicating the type, e.g. "${variants[0]?.concrete ?? base + "String"}".`,
      url: this.generateDocUrl(ctx.resourceType, `${ctx.fhirPath}.${base}[x]`),
    };
  }

  formatCardinalityArray(name: string, max: string, ctx: PropertyContext): ValidationIssue {
    return {
      severity: "error",
      path: `${ctx.jsonPath}.${name}`,
      code: "CARDINALITY_ERROR",
      message: `"${name}" must not be an array (max cardinality is ${max}).`,
      details:
        `"${ctx.fhirPath}.${name}" accepts a single value, not an array. Remove the array wrapper and provide the value directly. ` +
        `Example: "${name}": value instead of "${name}": [value].`,
      url: this.generateDocUrl(ctx.resourceType, `${ctx.fhirPath}.${name}`),
    };
  }

  formatCardinalityScalar(name: string, max: string, ctx: PropertyContext): ValidationIssue {
    return {
      severity: "error",
      path: `${ctx.jsonPath}.${name}`,
      code: "CARDINALITY_ERROR",
      message: `"${name}" must be an array (max cardinality is ${max}).`,
      details:
        `"${ctx.fhirPath}.${name}" is a repeating element and must be wrapped in a JSON array. ` +
        `Example: "${name}": [value] instead of "${name}": value.`,
      url: this.generateDocUrl(ctx.resourceType, `${ctx.fhirPath}.${name}`),
    };
  }

  formatPrimitiveTypeError(error: string, typeCode: string, ctx: PropertyContext): ValidationIssue {
    const info = PRIMITIVE_FORMAT[typeCode];
    const formatHint = info ? ` Expected format: ${info.format}. Example: ${info.example}.` : "";

    return {
      severity: "error",
      path: ctx.jsonPath,
      code: "INVALID_TYPE",
      message: `${error}${formatHint}`,
      details: `The value at "${ctx.fhirPath}" must be a valid FHIR "${typeCode}".`,
      url: `${this.fhirBase}/datatypes.html#${typeCode}`,
    };
  }

  formatExpectedObject(typeCode: string, actual: unknown, ctx: PropertyContext): ValidationIssue {
    const actualType = Array.isArray(actual) ? "array" : typeof actual;
    const example = TYPE_EXAMPLES[typeCode];
    const exampleHint = example ? ` Example ${typeCode}: ${example}` : "";

    return {
      severity: "error",
      path: ctx.jsonPath,
      code: "INVALID_TYPE",
      message: `Expected object for type "${typeCode}", got ${actualType}.${exampleHint}`,
      details: `"${ctx.fhirPath}" must be a JSON object conforming to the ${typeCode} type, but received ${actualType}.`,
      url: `${this.fhirBase}/datatypes.html#${typeCode}`,
    };
  }

  formatNullArrayElement(index: number, ctx: PropertyContext): ValidationIssue {
    return {
      severity: "error",
      path: ctx.jsonPath,
      code: "INVALID_TYPE",
      message: "Array element must not be null or undefined.",
      details:
        `FHIR arrays must not contain null values. Element at index ${index} is null. ` +
        "Remove null entries or replace them with valid values.",
      url: `${this.fhirBase}/json.html#null`,
    };
  }

  formatChoiceTypeMultiple(base: string, present: string[], ctx: PropertyContext): ValidationIssue {
    return {
      severity: "error",
      path: `${ctx.jsonPath}.${base}[x]`,
      code: "CHOICE_TYPE_MULTIPLE",
      message: `Choice type "${base}[x]" must have at most one variant, found: ${present.join(", ")}.`,
      details:
        `FHIR choice types allow only one variant per element. ` +
        `Found ${present.length} variants: ${present.join(", ")}. Keep only one and remove the others.`,
      url: this.generateDocUrl(ctx.resourceType, `${ctx.fhirPath}.${base}[x]`),
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private generateDocUrl(resourceType: string, fhirPath: string): string {
    // Type-level paths (e.g. "HumanName.family") → datatypes.html
    const firstSegment = fhirPath.split(".")[0];
    const isResourceType =
      firstSegment.charAt(0) === firstSegment.charAt(0).toUpperCase() &&
      ![
        "HumanName",
        "CodeableConcept",
        "Identifier",
        "Reference",
        "Quantity",
        "Period",
        "Coding",
        "Address",
        "ContactPoint",
        "Attachment",
        "Meta",
        "Narrative",
        "Dosage",
        "BackboneElement",
        "Element",
        "Timing",
        "Signature",
        "Annotation",
        "SampledData",
        "Range",
        "Ratio",
        "Age",
        "Distance",
        "Duration",
        "Count",
        "Money",
        "MoneyQuantity",
        "SimpleQuantity",
      ].includes(firstSegment);

    if (isResourceType) {
      return `${this.fhirBase}/${resourceType.toLowerCase()}-definitions.html#${fhirPath}`;
    }
    return `${this.fhirBase}/datatypes-definitions.html#${fhirPath}`;
  }
}
