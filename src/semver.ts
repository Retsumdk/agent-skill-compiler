/** Minimal semantic-version parsing and range checks (^, ~, exact, *). */
import { ValidationError } from "./errors.js";

export interface Version {
  major: number;
  minor: number;
  patch: number;
}

export function parseVersion(text: string): Version {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(text);
  if (match === null) {
    throw new ValidationError(`version ${JSON.stringify(text)} is not x.y.z`);
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

export function compare(a: Version, b: Version): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

function parseRange(range: string): { floor: Version; ceil: Version | null; exact: boolean } {
  if (range === "*" || range === "") return { floor: { major: 0, minor: 0, patch: 0 }, ceil: null, exact: false };
  const body = range.startsWith("^") || range.startsWith("~") ? range.slice(1) : range;
  const base = parseVersion(body);
  if (range.startsWith("^")) {
    return { floor: base, ceil: { major: base.major + 1, minor: 0, patch: 0 }, exact: false };
  }
  if (range.startsWith("~")) {
    return { floor: base, ceil: { major: base.major, minor: base.minor + 1, patch: 0 }, exact: false };
  }
  return { floor: base, ceil: base, exact: true };
}

export function isWellFormedRange(range: string): boolean {
  if (range === "*" || range === "") return true;
  if (range.startsWith("^") || range.startsWith("~")) {
    return /^\^?\d+\.\d+\.\d+$/.test(range) || /^~?\d+\.\d+\.\d+$/.test(range);
  }
  return /^\d+\.\d+\.\d+$/.test(range);
}

/** True when `version` satisfies `range` (supports ^x.y.z, ~x.y.z, x.y.z, *). */
export function satisfies(version: string, range: string): boolean {
  const v = parseVersion(version);
  const { floor, ceil, exact } = parseRange(range);
  if (compare(v, floor) < 0) return false;
  if (ceil === null) return true;
  return exact ? compare(v, ceil) === 0 : compare(v, ceil) < 0;
}
