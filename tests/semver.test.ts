import { describe, expect, test } from "bun:test";
import { isWellFormedRange, parseVersion, satisfies } from "../src/semver.js";
import { ValidationError } from "../src/errors.js";

describe("parseVersion", () => {
  test("accepts x.y.z", () => {
    expect(parseVersion("1.2.3")).toEqual({ major: 1, minor: 2, patch: 3 });
    expect(parseVersion("0.0.0")).toEqual({ major: 0, minor: 0, patch: 0 });
  });
  test("rejects non x.y.z", () => {
    expect(() => parseVersion("1.2")).toThrow(ValidationError);
    expect(() => parseVersion("v1.2.3")).toThrow(ValidationError);
    expect(() => parseVersion("1.2.x")).toThrow(ValidationError);
  });
});

describe("satisfies", () => {
  test("caret", () => {
    expect(satisfies("1.0.0", "^1.0.0")).toBe(true);
    expect(satisfies("1.9.9", "^1.0.0")).toBe(true);
    expect(satisfies("2.0.0", "^1.0.0")).toBe(false);
    expect(satisfies("0.9.0", "^1.0.0")).toBe(false);
  });
  test("tilde", () => {
    expect(satisfies("1.2.9", "~1.2.0")).toBe(true);
    expect(satisfies("1.3.0", "~1.2.0")).toBe(false);
  });
  test("exact and star", () => {
    expect(satisfies("1.2.3", "1.2.3")).toBe(true);
    expect(satisfies("1.2.4", "1.2.3")).toBe(false);
    expect(satisfies("9.9.9", "*")).toBe(true);
    expect(satisfies("0.0.1", "")).toBe(true);
  });
});

describe("isWellFormedRange", () => {
  test("accepts known shapes", () => {
    for (const range of ["*", "", "^1.0.0", "~0.4.1", "2.0.0"]) {
      expect(isWellFormedRange(range)).toBe(true);
    }
  });
  test("rejects everything else", () => {
    for (const range of ["^1.0", "latest", ">=1.0.0", "^a.b.c", "1.2.3.4"]) {
      expect(isWellFormedRange(range)).toBe(false);
    }
  });
});
