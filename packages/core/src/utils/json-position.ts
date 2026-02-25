export interface JsonPosition {
  line: number; // 0-based
  startChar: number; // 0-based
  endChar: number; // 0-based, exclusive
}

/**
 * Given a JSON string and a FHIR path like "Patient.name[0].family",
 * returns the position of the value at that path in the text.
 *
 * Path parsing:
 *   - "Patient.name[0].family" → strip resourceType prefix → ["name", 0, "family"]
 *   - "resourceType" (no dot) → ["resourceType"]
 *   - "" (empty) → root position {0, 0, 1}
 */
export function resolveJsonPosition(jsonText: string, fhirPath: string): JsonPosition | undefined {
  if (fhirPath === "") {
    return { line: 0, startChar: 0, endChar: 1 };
  }

  const segments = parsePath(fhirPath);
  if (segments.length === 0) {
    return { line: 0, startChar: 0, endChar: 1 };
  }

  return findPosition(jsonText, segments);
}

type Segment = string | number;

function parsePath(fhirPath: string): Segment[] {
  // "resourceType" → ["resourceType"]
  if (!fhirPath.includes(".")) {
    return [fhirPath];
  }

  // "Patient.name[0].family" → strip "Patient." → "name[0].family"
  const dotIndex = fhirPath.indexOf(".");
  const rest = fhirPath.slice(dotIndex + 1);

  const segments: Segment[] = [];
  for (const part of rest.split(".")) {
    // Handle array indices: "name[0]" → "name", 0
    const bracketIndex = part.indexOf("[");
    if (bracketIndex !== -1) {
      segments.push(part.slice(0, bracketIndex));
      const idxStr = part.slice(bracketIndex + 1, part.indexOf("]"));
      segments.push(parseInt(idxStr, 10));
    } else {
      segments.push(part);
    }
  }

  return segments;
}

/**
 * State-machine JSON scanner to find the position of a value at the given path.
 */
function findPosition(text: string, targetSegments: Segment[]): JsonPosition | undefined {
  let i = 0;
  const len = text.length;
  let line = 0;
  let lineStart = 0;

  // Stack tracks the current position in the JSON tree
  const pathStack: Segment[] = [];
  // Depth tracking for skipping nested structures
  let segmentIndex = 0;

  function col(): number {
    return i - lineStart;
  }

  function advance(): void {
    if (text[i] === "\n") {
      line++;
      lineStart = i + 1;
    }
    i++;
  }

  function skipWhitespace(): void {
    while (
      i < len &&
      (text[i] === " " || text[i] === "\t" || text[i] === "\r" || text[i] === "\n")
    ) {
      advance();
    }
  }

  function readString(): string {
    // i should be at opening quote
    i++; // skip opening quote
    let result = "";
    while (i < len && text[i] !== '"') {
      if (text[i] === "\\") {
        i++; // skip backslash
        if (text[i] === "u") {
          // unicode escape \uXXXX
          result += text.slice(i - 1, i + 5);
          i += 4;
        } else {
          result += text[i];
        }
        i++;
      } else {
        result += text[i];
        i++;
      }
    }
    i++; // skip closing quote
    return result;
  }

  function pathMatches(): boolean {
    if (pathStack.length !== segmentIndex + 1) return false;
    for (let j = 0; j <= segmentIndex; j++) {
      if (pathStack[j] !== targetSegments[j]) return false;
    }
    return true;
  }

  function captureValuePosition(): JsonPosition {
    const startLine = line;
    const startChar = col();
    skipValue();
    const endChar = col();
    // If value spans multiple lines, endChar is on the last line
    return { line: startLine, startChar, endChar };
  }

  function skipValue(): void {
    skipWhitespace();
    if (i >= len) return;

    const ch = text[i];
    if (ch === '"') {
      skipString();
    } else if (ch === "{") {
      skipObject();
    } else if (ch === "[") {
      skipArray();
    } else {
      // number, boolean, null
      skipLiteral();
    }
  }

  function skipString(): void {
    i++; // opening quote
    while (i < len && text[i] !== '"') {
      if (text[i] === "\\") {
        advance();
      }
      advance();
    }
    if (i < len) i++; // closing quote
  }

  function skipObject(): void {
    i++; // opening brace
    let depth = 1;
    while (i < len && depth > 0) {
      const ch = text[i];
      if (ch === '"') {
        skipString();
      } else if (ch === "{") {
        depth++;
        advance();
      } else if (ch === "}") {
        depth--;
        advance();
      } else {
        advance();
      }
    }
  }

  function skipArray(): void {
    i++; // opening bracket
    let depth = 1;
    while (i < len && depth > 0) {
      const ch = text[i];
      if (ch === '"') {
        skipString();
      } else if (ch === "[") {
        depth++;
        advance();
      } else if (ch === "]") {
        depth--;
        advance();
      } else if (ch === "{") {
        // Need to handle nested objects inside arrays properly
        skipObject();
      } else {
        advance();
      }
    }
  }

  function skipLiteral(): void {
    while (
      i < len &&
      text[i] !== "," &&
      text[i] !== "}" &&
      text[i] !== "]" &&
      text[i] !== " " &&
      text[i] !== "\t" &&
      text[i] !== "\r" &&
      text[i] !== "\n"
    ) {
      i++;
    }
  }

  // Main scan: we need to walk the JSON tree along the target path
  function scanValue(): JsonPosition | undefined {
    skipWhitespace();
    if (i >= len) return undefined;

    // Check if current path matches the full target
    if (pathStack.length === targetSegments.length && pathMatches()) {
      return captureValuePosition();
    }

    const ch = text[i];
    if (ch === "{") {
      return scanObject();
    } else if (ch === "[") {
      return scanArray();
    } else {
      // Primitive at wrong path — skip it
      skipValue();
      return undefined;
    }
  }

  function scanObject(): JsonPosition | undefined {
    i++; // skip {
    skipWhitespace();

    if (i < len && text[i] === "}") {
      i++;
      return undefined;
    }

    while (i < len) {
      skipWhitespace();
      if (i >= len || text[i] === "}") {
        i++;
        return undefined;
      }

      // Read key
      if (text[i] !== '"') {
        // Invalid JSON, bail
        return undefined;
      }
      const key = readString();

      skipWhitespace();
      if (i < len && text[i] === ":") i++; // skip colon
      skipWhitespace();

      // Check if this key is on our target path
      const nextSegment = targetSegments[pathStack.length];
      if (key === nextSegment) {
        pathStack.push(key);
        segmentIndex = pathStack.length - 1;

        if (pathStack.length === targetSegments.length) {
          // This is the target — capture value position
          return captureValuePosition();
        }

        // Need to go deeper
        const result = scanValue();
        if (result !== undefined) return result;

        pathStack.pop();
        segmentIndex = pathStack.length - 1;
      } else {
        // Not on our path — skip value
        skipValue();
      }

      skipWhitespace();
      if (i < len && text[i] === ",") {
        i++;
      }
    }

    return undefined;
  }

  function scanArray(): JsonPosition | undefined {
    i++; // skip [
    skipWhitespace();

    if (i < len && text[i] === "]") {
      i++;
      return undefined;
    }

    let arrayIndex = 0;
    while (i < len) {
      skipWhitespace();
      if (i >= len || text[i] === "]") {
        i++;
        return undefined;
      }

      const nextSegment = targetSegments[pathStack.length];
      if (arrayIndex === nextSegment) {
        pathStack.push(arrayIndex);
        segmentIndex = pathStack.length - 1;

        if (pathStack.length === targetSegments.length) {
          return captureValuePosition();
        }

        const result = scanValue();
        if (result !== undefined) return result;

        pathStack.pop();
        segmentIndex = pathStack.length - 1;
      } else if (typeof nextSegment === "number" && arrayIndex > nextSegment) {
        // Past the target index — early exit
        return undefined;
      } else {
        skipValue();
      }

      skipWhitespace();
      if (i < len && text[i] === ",") {
        i++;
      }
      arrayIndex++;
    }

    return undefined;
  }

  return scanValue();
}
