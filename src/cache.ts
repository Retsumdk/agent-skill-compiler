/** Content-addressed compiled-unit caches (memory + atomic disk-backed). */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { CompiledUnit } from "./types.js";

export interface UnitCache {
  get(key: string): CompiledUnit | undefined;
  put(unit: CompiledUnit): void;
  stats(): { entries: number; hits: number; misses: number };
}

function canonical(value: unknown): string {
  return JSON.stringify(value, (key, val) =>
    val instanceof Map
      ? Object.fromEntries([...val.entries()].sort())
      : Array.isArray(val) || (val !== null && typeof val === "object")
        ? Object.fromEntries(Object.keys(val).sort().map((k) => [k, (val as Record<string, unknown>)[k]]))
        : val);
}

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function unitKey(definition: SkillDefinitionInput, depKeys: string[]): string {
  return sha256(canonical({ definition, depKeys: [...depKeys].sort() }));
}

type SkillDefinitionInput = import("./types.js").SkillDefinition;

export function contentHash(value: unknown): string {
  return sha256(canonical(value));
}

abstract class BaseCache implements UnitCache {
  protected entries = new Map<string, CompiledUnit>();
  protected hits = 0;
  protected misses = 0;

  stats(): { entries: number; hits: number; misses: number } {
    return { entries: this.entries.size, hits: this.hits, misses: this.misses };
  }

  abstract get(key: string): CompiledUnit | undefined;
  abstract put(unit: CompiledUnit): void;
}

export class MemoryCache extends BaseCache {
  get(key: string): CompiledUnit | undefined {
    const unit = this.entries.get(key);
    if (unit === undefined) {
      this.misses += 1;
      return undefined;
    }
    this.hits += 1;
    return unit;
  }

  put(unit: CompiledUnit): void {
    this.entries.set(unit.key, unit);
  }
}

const UNIT_SHAPE = {
  name: (v: unknown): v is string => typeof v === "string",
  version: (v: unknown): v is string => typeof v === "string",
  instructions: (v: unknown): v is string => typeof v === "string",
  tools: (v: unknown): v is string[] => Array.isArray(v) && v.every((t) => typeof t === "string"),
  dependencies: (v: unknown): v is string[] => Array.isArray(v) && v.every((t) => typeof t === "string"),
  key: (v: unknown): v is string => typeof v === "string",
};

export class DiskCache extends BaseCache {
  private readonly dir: string;

  constructor(dir: string) {
    super();
    this.dir = dir;
    mkdirSync(dir, { recursive: true });
  }

  private pathFor(key: string): string {
    return join(this.dir, `${sha256(key)}.unit.json`);
  }

  get(key: string): CompiledUnit | undefined {
    const cached = this.entries.get(key);
    if (cached !== undefined) {
      this.hits += 1;
      return cached;
    }
    let raw: string;
    try {
      raw = readFileSync(this.pathFor(key), "utf8");
    } catch {
      this.misses += 1;
      return undefined;
    }
    try {
      const unit = validateUnit(JSON.parse(raw));
      if (unit.key !== key) {
        this.misses += 1;
        return undefined;
      }
      this.entries.set(key, unit);
      this.hits += 1;
      return unit;
    } catch {
      this.misses += 1;
      return undefined;
    }
  }

  put(unit: CompiledUnit): void {
    this.entries.set(unit.key, unit);
    const target = this.pathFor(unit.key);
    const tmp = `${target}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(unit, null, 2) + "\n");
    renameSync(tmp, target);
  }

  clear(): void {
    this.entries.clear();
    for (const file of readdirSync(this.dir)) {
      if (file.endsWith(".unit.json")) rmSync(join(this.dir, file));
    }
  }
}

function validateUnit(value: unknown): CompiledUnit {
  if (value === null || typeof value !== "object") {
    throw new Error("cache unit is not an object");
  }
  const record = value as Record<string, unknown>;
  for (const [field, check] of Object.entries(UNIT_SHAPE)) {
    if (!check(record[field])) throw new Error(`cache unit field ${field} has the wrong shape`);
  }
  return record as unknown as CompiledUnit;
}
