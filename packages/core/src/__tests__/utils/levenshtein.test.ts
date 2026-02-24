import { describe, it, expect } from "vitest";
import { levenshteinDistance, findClosestMatch } from "../../utils/levenshtein.js";

describe("levenshteinDistance", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshteinDistance("same", "same")).toBe(0);
  });

  it("returns length of other string when one is empty", () => {
    expect(levenshteinDistance("", "abc")).toBe(3);
    expect(levenshteinDistance("abc", "")).toBe(3);
  });

  it("returns 0 for two empty strings", () => {
    expect(levenshteinDistance("", "")).toBe(0);
  });

  it("computes classic kitten→sitting = 3", () => {
    expect(levenshteinDistance("kitten", "sitting")).toBe(3);
  });

  it("computes single character difference", () => {
    expect(levenshteinDistance("cat", "hat")).toBe(1);
  });

  it("computes insertion distance", () => {
    expect(levenshteinDistance("name", "nmae")).toBe(2);
  });

  it("handles case sensitivity", () => {
    expect(levenshteinDistance("Name", "name")).toBe(1);
  });

  it("is symmetric", () => {
    expect(levenshteinDistance("abc", "xyz")).toBe(levenshteinDistance("xyz", "abc"));
  });
});

describe("findClosestMatch", () => {
  const candidates = ["name", "status", "active", "gender", "birthDate"];

  it("finds exact match (distance 0)", () => {
    expect(findClosestMatch("name", candidates)).toBe("name");
  });

  it("finds close match for typo", () => {
    expect(findClosestMatch("nme", candidates)).toBe("name");
  });

  it("finds close match for transposition", () => {
    expect(findClosestMatch("nmae", candidates)).toBe("name");
  });

  it("finds close match for statis→status", () => {
    expect(findClosestMatch("statis", candidates)).toBe("status");
  });

  it("returns undefined for distant string", () => {
    expect(findClosestMatch("zzzzz", candidates)).toBeUndefined();
  });

  it("returns undefined for empty candidates", () => {
    expect(findClosestMatch("name", [])).toBeUndefined();
  });

  it("respects custom maxDistance", () => {
    expect(findClosestMatch("nme", candidates, 1)).toBe("name");
    expect(findClosestMatch("nmae", candidates, 1)).toBeUndefined();
  });

  it("picks the closest when multiple are within range", () => {
    expect(findClosestMatch("activ", ["active", "action", "actor"])).toBe("active");
  });
});
