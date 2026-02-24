import type { DefinitionLoader } from "../loader/DefinitionLoader.js";
import type { ElementDefinition } from "../loader/types.js";
import type { ValidationIssue, ValidationResult } from "../types.js";
import { validatePrimitive } from "./primitives.js";

const PRIMITIVE_TYPES = new Set([
  "boolean",
  "integer",
  "positiveInt",
  "unsignedInt",
  "decimal",
  "string",
  "markdown",
  "xhtml",
  "code",
  "id",
  "uri",
  "url",
  "canonical",
  "oid",
  "uuid",
  "date",
  "dateTime",
  "instant",
  "time",
  "base64Binary",
]);

/** Properties allowed on any FHIR element without being defined in the snapshot. */
const UNIVERSAL_PROPS = new Set(["id", "extension"]);

export class StructureValidator {
  constructor(private readonly loader: DefinitionLoader) {}

  validate(resource: unknown): ValidationResult {
    const issues: ValidationIssue[] = [];

    if (resource === null || resource === undefined) {
      issues.push({
        severity: "error",
        path: "",
        message: "Resource must be a non-null object",
        code: "INVALID_RESOURCE",
      });
      return { valid: false, issues };
    }

    if (Array.isArray(resource)) {
      issues.push({
        severity: "error",
        path: "",
        message: "Resource must be an object, not an array",
        code: "INVALID_RESOURCE",
      });
      return { valid: false, issues };
    }

    if (typeof resource !== "object") {
      issues.push({
        severity: "error",
        path: "",
        message: `Resource must be an object, got ${typeof resource}`,
        code: "INVALID_RESOURCE",
      });
      return { valid: false, issues };
    }

    const obj = resource as Record<string, unknown>;

    if (!("resourceType" in obj) || obj.resourceType === undefined) {
      issues.push({
        severity: "error",
        path: "",
        message: "Resource is missing required field 'resourceType'",
        code: "MISSING_RESOURCE_TYPE",
      });
      return { valid: false, issues };
    }

    if (typeof obj.resourceType !== "string" || obj.resourceType.trim() === "") {
      issues.push({
        severity: "error",
        path: "resourceType",
        message: "resourceType must be a non-empty string",
        code: "INVALID_RESOURCE_TYPE",
      });
      return { valid: false, issues };
    }

    const resourceType = obj.resourceType;
    const sd = this.loader.getResourceDefinition(resourceType);

    if (!sd) {
      issues.push({
        severity: "error",
        path: "resourceType",
        message: `Unknown resource type: "${resourceType}"`,
        code: "UNKNOWN_RESOURCE_TYPE",
      });
      return { valid: false, issues };
    }

    const elements = sd.snapshot?.element ?? [];
    this.validateObject(obj, resourceType, elements, resourceType, issues);

    return {
      valid: issues.every((i) => i.severity !== "error"),
      issues,
    };
  }

  private validateObject(
    obj: Record<string, unknown>,
    fhirBasePath: string,
    elements: ElementDefinition[],
    jsonPath: string,
    issues: ValidationIssue[],
  ): void {
    const children = this.getDirectChildren(elements, fhirBasePath);
    const { choiceMap, choiceGroups } = this.resolveChoiceTypes(children);

    // Unknown properties
    for (const key of Object.keys(obj)) {
      if (key === "resourceType" && jsonPath === fhirBasePath) continue;
      if (key.startsWith("_")) continue;
      if (UNIVERSAL_PROPS.has(key)) continue;
      if (children.has(key)) continue;
      if (choiceMap.has(key)) continue;

      issues.push({
        severity: "error",
        path: `${jsonPath}.${key}`,
        message: `Unknown property "${key}"`,
        code: "UNKNOWN_PROPERTY",
      });
    }

    // Required fields
    for (const [propName, elDef] of children) {
      if ((elDef.min ?? 0) < 1) continue;

      // Regular required field
      if (!elDef.path.endsWith("[x]")) {
        const val = obj[propName];
        if (val === undefined || val === null) {
          issues.push({
            severity: "error",
            path: `${jsonPath}.${propName}`,
            message: `Missing required field "${propName}"`,
            code: "REQUIRED_FIELD",
          });
        } else if (Array.isArray(val) && val.length === 0) {
          issues.push({
            severity: "error",
            path: `${jsonPath}.${propName}`,
            message: `Required field "${propName}" must not be an empty array`,
            code: "REQUIRED_FIELD",
          });
        }
        continue;
      }

      // Required choice type — at least one variant present
      const baseName = propName.replace("[x]", "");
      const group = choiceGroups.get(baseName);
      if (!group) continue;
      const hasOne = group.some(({ concrete }) => obj[concrete] !== undefined && obj[concrete] !== null);
      if (!hasOne) {
        issues.push({
          severity: "error",
          path: `${jsonPath}.${baseName}[x]`,
          message: `Required choice type "${baseName}[x]" must have at least one variant present`,
          code: "REQUIRED_FIELD",
        });
      }
    }

    // Choice type constraint: at most one variant per group
    for (const [baseName, group] of choiceGroups) {
      const presentVariants = group.filter(
        ({ concrete }) => obj[concrete] !== undefined && obj[concrete] !== null,
      );
      if (presentVariants.length > 1) {
        issues.push({
          severity: "error",
          path: `${jsonPath}.${baseName}[x]`,
          message: `Choice type "${baseName}[x]" must have at most one variant, found: ${presentVariants.map((v) => v.concrete).join(", ")}`,
          code: "CHOICE_TYPE_MULTIPLE",
        });
      }
    }

    // Per-property validation
    for (const [propName, elDef] of children) {
      if (elDef.path.endsWith("[x]")) continue; // handled via choiceMap
      const value = obj[propName];
      if (value === undefined || value === null) continue;
      const typeCode = elDef.type?.[0]?.code;
      if (!typeCode) continue;
      this.validateProperty(value, elDef, typeCode, jsonPath, propName, elements, issues);
    }

    // Per choice-type property validation
    for (const [concrete, { elDef, typeCode }] of choiceMap) {
      const value = obj[concrete];
      if (value === undefined || value === null) continue;
      this.validateProperty(value, elDef, typeCode, jsonPath, concrete, elements, issues);
    }
  }

  private validateProperty(
    value: unknown,
    elDef: ElementDefinition,
    resolvedTypeCode: string,
    jsonPath: string,
    propName: string,
    elements: ElementDefinition[],
    issues: ValidationIssue[],
  ): void {
    const maxStr = elDef.max ?? "*";
    const isSingular = maxStr === "1" || maxStr === "0";

    if (isSingular) {
      if (Array.isArray(value)) {
        issues.push({
          severity: "error",
          path: `${jsonPath}.${propName}`,
          message: `"${propName}" must not be an array (max cardinality is ${maxStr})`,
          code: "CARDINALITY_ERROR",
        });
        return;
      }
      this.validateSingleValue(value, elDef, resolvedTypeCode, `${jsonPath}.${propName}`, elements, issues);
    } else {
      if (!Array.isArray(value)) {
        issues.push({
          severity: "error",
          path: `${jsonPath}.${propName}`,
          message: `"${propName}" must be an array (max cardinality is ${maxStr})`,
          code: "CARDINALITY_ERROR",
        });
        return;
      }
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (item === null || item === undefined) {
          issues.push({
            severity: "error",
            path: `${jsonPath}.${propName}[${i}]`,
            message: `Array element must not be null`,
            code: "INVALID_TYPE",
          });
          continue;
        }
        this.validateSingleValue(item, elDef, resolvedTypeCode, `${jsonPath}.${propName}[${i}]`, elements, issues);
      }
    }
  }

  private validateSingleValue(
    value: unknown,
    elDef: ElementDefinition,
    typeCode: string,
    valuePath: string,
    elements: ElementDefinition[],
    issues: ValidationIssue[],
  ): void {
    // Primitive types
    if (PRIMITIVE_TYPES.has(typeCode)) {
      const err = validatePrimitive(typeCode, value);
      if (err) {
        issues.push({
          severity: "error",
          path: valuePath,
          message: err,
          code: "INVALID_TYPE",
        });
      }
      return;
    }

    // Complex / BackboneElement types — must be an object
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      issues.push({
        severity: "error",
        path: valuePath,
        message: `Expected object for type "${typeCode}", got ${Array.isArray(value) ? "array" : typeof value}`,
        code: "INVALID_TYPE",
      });
      return;
    }

    const obj = value as Record<string, unknown>;

    // Check for inline children in the same snapshot first (BackboneElement pattern)
    const inlinePath = elDef.path;
    const inlineChildren = this.getDirectChildren(elements, inlinePath);
    if (inlineChildren.size > 0) {
      this.validateObject(obj, inlinePath, elements, valuePath, issues);
      return;
    }

    // Fallback: load type StructureDefinition
    const typeSd = this.loader.getTypeDefinition(typeCode);
    if (typeSd?.snapshot?.element) {
      this.validateObject(obj, typeCode, typeSd.snapshot.element, valuePath, issues);
    }
  }

  /**
   * Get direct child elements of a given base path.
   * e.g. for "Patient" returns elements like "Patient.name", "Patient.active"
   * but NOT "Patient.name.family" (grandchildren).
   */
  private getDirectChildren(
    elements: ElementDefinition[],
    basePath: string,
  ): Map<string, ElementDefinition> {
    const prefix = basePath + ".";
    const result = new Map<string, ElementDefinition>();

    for (const el of elements) {
      if (!el.path.startsWith(prefix)) continue;
      const rest = el.path.slice(prefix.length);
      if (rest.includes(".")) continue; // grandchild
      const propName = rest; // may contain [x]
      result.set(propName, el);
    }

    return result;
  }

  /**
   * Resolve choice type elements (those ending in [x]) into concrete property name mappings.
   *
   * Returns:
   * - choiceMap: concrete prop name → { elDef, typeCode } (for lookup during property validation)
   * - choiceGroups: base name → array of { concrete, typeCode } (for multi-variant checking)
   */
  private resolveChoiceTypes(
    children: Map<string, ElementDefinition>,
  ): {
    choiceMap: Map<string, { elDef: ElementDefinition; typeCode: string }>;
    choiceGroups: Map<string, { concrete: string; typeCode: string }[]>;
  } {
    const choiceMap = new Map<string, { elDef: ElementDefinition; typeCode: string }>();
    const choiceGroups = new Map<string, { concrete: string; typeCode: string }[]>();

    for (const [propName, elDef] of children) {
      if (!propName.endsWith("[x]")) continue;
      const baseName = propName.replace("[x]", "");
      const types = elDef.type ?? [];
      const group: { concrete: string; typeCode: string }[] = [];

      for (const t of types) {
        const typeCode = t.code;
        const concrete = baseName + typeCode.charAt(0).toUpperCase() + typeCode.slice(1);
        choiceMap.set(concrete, { elDef, typeCode });
        group.push({ concrete, typeCode });
      }

      choiceGroups.set(baseName, group);
    }

    return { choiceMap, choiceGroups };
  }
}
