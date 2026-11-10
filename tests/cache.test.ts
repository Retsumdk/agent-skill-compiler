import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { contentHash, DiskCache, MemoryCache, sha256, unitKey } from "../src/cache.js";
import type { CompiledUnit } from "../src/types.js";

function unit(name: string, key: string): CompiledUnit {
  return { name, version: "1.0.0", instructions: `do ${name}`, tools: [`${name}.run`], dependencies: [], key };
}

describe("hashing", () => {
  test("sha256/contentHash are stable and key-sensitive", () => {
    expect(sha256("abc")).toBe(sha256("abc"));
    expect(sha256("abc")).not.toBe(sha256("abd"));
    expect(contentHash({ b: 1, a: 2 })).toBe(contentHash({ a: 2, b: 1 }));
    expect(unitKey({ name: "x" } as never, ["dep@1"])).toBe(unitKey({ name: "x" } as never, ["dep@1"]));
    expect(unitKey({ name: "x" } as never, ["a"])).not.toBe(unitKey({ name: "x" } as never, ["b"]));
  });
});

describe("MemoryCache", () => {
  test("hit/miss accounting", () => {
    const cache = new MemoryCache();
    expect(cache.get("k1")).toBeUndefined();
    cache.put(unit("u", "k1"));
    expect(cache.get("k1")?.name).toBe("u");
    expect(cache.get("nope")).toBeUndefined();
    expect(cache.stats()).toEqual({ entries: 1, hits: 1, misses: 2 });
  });
});

describe("DiskCache", () => {
  test("round-trips across instances (atomic files)", () => {
    const dir = mkdtempSync(join(tmpdir(), "asc-cache-"));
    const first = new DiskCache(dir);
    expect(first.get("key-1")).toBeUndefined();
    first.put(unit("lib", "key-1"));
    const second = new DiskCache(dir);
    expect(second.get("key-1")?.name).toBe("lib");
    expect(second.get("key-1")).toBeDefined();
    expect(second.stats().hits).toBe(2);
  });
  test("tolerates corrupt or wrong-key files", () => {
    const dir = mkdtempSync(join(tmpdir(), "asc-cache-"));
    const cache = new DiskCache(dir);
    cache.put(unit("lib", "key-1"));
    const file = join(dir, "deadbeef.unit.json");
    writeFileSync(file, "{not json");
    writeFileSync(join(dir, "other.unit.json"), JSON.stringify({ name: 42 }));
    expect(cache.get("deadbeef")).toBeUndefined();
    expect(cache.get("key-1")?.name).toBe("lib");
  });
  test("clear removes everything", () => {
    const dir = mkdtempSync(join(tmpdir(), "asc-cache-"));
    const cache = new DiskCache(dir);
    cache.put(unit("lib", "key-1"));
    cache.clear();
    expect(cache.stats()).toEqual({ entries: 0, hits: 0, misses: 0 });
    expect(new DiskCache(dir).get("key-1")).toBeUndefined();
  });
  test("stored file validates against unit shape", () => {
    const dir = mkdtempSync(join(tmpdir(), "asc-cache-"));
    const cache = new DiskCache(dir);
    cache.put(unit("lib", "key-1"));
    const written = JSON.parse(readFileSync(join(dir, `${sha256("key-1")}.unit.json`), "utf8"));
    expect(written.name).toBe("lib");
    expect(written.key).toBe("key-1");
  });
});
