const PRIMITIVE_STRING_TYPES = new Set([
  "string",
  "markdown",
  "xhtml",
  "uri",
  "url",
  "canonical",
]);

const ID_REGEX = /^[A-Za-z0-9\-.]{1,64}$/;
const OID_REGEX = /^urn:oid:[0-2](\.(0|[1-9]\d*))+$/;
const UUID_REGEX =
  /^urn:uuid:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const DATE_REGEX = /^\d{4}(-\d{2}(-\d{2})?)?$/;
const DATETIME_REGEX =
  /^\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?)?)?$/;
const INSTANT_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const TIME_REGEX = /^\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;
const BASE64_REGEX = /^[A-Za-z0-9+/\n\r]+=*$/;

function validateInteger(value: unknown): string | null {
  if (typeof value !== "number") return `Expected number, got ${typeof value}`;
  if (!Number.isFinite(value)) return "Value must be finite";
  if (!Number.isInteger(value)) return "Value must be an integer";
  return null;
}

/**
 * Validates a FHIR primitive value against its type code.
 * Returns null if valid, or an error message string if invalid.
 */
export function validatePrimitive(typeCode: string, value: unknown): string | null {
  switch (typeCode) {
    case "boolean":
      return typeof value === "boolean"
        ? null
        : `Expected boolean, got ${typeof value}`;

    case "integer": {
      return validateInteger(value);
    }

    case "positiveInt": {
      const err = validateInteger(value);
      if (err) return err;
      return (value as number) > 0
        ? null
        : `Value must be positive, got ${value}`;
    }

    case "unsignedInt": {
      const err = validateInteger(value);
      if (err) return err;
      return (value as number) >= 0
        ? null
        : `Value must be non-negative, got ${value}`;
    }

    case "decimal":
      if (typeof value !== "number")
        return `Expected number, got ${typeof value}`;
      if (!Number.isFinite(value)) return "Value must be finite";
      return null;

    case "code":
      if (typeof value !== "string")
        return `Expected string, got ${typeof value}`;
      return value.trim().length > 0
        ? null
        : "Code must be non-empty after trimming";

    case "id":
      if (typeof value !== "string")
        return `Expected string, got ${typeof value}`;
      return ID_REGEX.test(value)
        ? null
        : `Invalid id format: "${value}"`;

    case "oid":
      if (typeof value !== "string")
        return `Expected string, got ${typeof value}`;
      return OID_REGEX.test(value)
        ? null
        : `Invalid oid format: "${value}"`;

    case "uuid":
      if (typeof value !== "string")
        return `Expected string, got ${typeof value}`;
      return UUID_REGEX.test(value)
        ? null
        : `Invalid uuid format: "${value}"`;

    case "date":
      if (typeof value !== "string")
        return `Expected string, got ${typeof value}`;
      return DATE_REGEX.test(value)
        ? null
        : `Invalid date format: "${value}"`;

    case "dateTime":
      if (typeof value !== "string")
        return `Expected string, got ${typeof value}`;
      return DATETIME_REGEX.test(value)
        ? null
        : `Invalid dateTime format: "${value}"`;

    case "instant":
      if (typeof value !== "string")
        return `Expected string, got ${typeof value}`;
      return INSTANT_REGEX.test(value)
        ? null
        : `Invalid instant format: "${value}"`;

    case "time":
      if (typeof value !== "string")
        return `Expected string, got ${typeof value}`;
      return TIME_REGEX.test(value)
        ? null
        : `Invalid time format: "${value}"`;

    case "base64Binary":
      if (typeof value !== "string")
        return `Expected string, got ${typeof value}`;
      if (value.length === 0) return null;
      return BASE64_REGEX.test(value)
        ? null
        : `Invalid base64Binary format`;

    default:
      if (PRIMITIVE_STRING_TYPES.has(typeCode)) {
        return typeof value === "string"
          ? null
          : `Expected string, got ${typeof value}`;
      }
      return null;
  }
}
