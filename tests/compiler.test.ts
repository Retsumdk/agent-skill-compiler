import { describe, expect, test } from "bun:test";
import { compile } from "../src/compiler.js";
import { MemoryCache } from "../src/cache.js";
import type { SkillDefinition } from "../src/types.js";

function skill(name: string, dependsOn: string[], tools = [`${name.replace(/-/g, "")}.run`], version = "1.0.0"): SkillDefinition {
  return { name, version, instructions: `rule ${name}`, tools, dependsOn };
}

describe("compile", () => {
  test("merges instructions in dependency order without duplication", () => {
    const result = compile([
      skill("app", ["lib"], ["app.run", "lib.run"]),
      skill("lib", [], ["lib.run"]),
    ]);
    const app = result.units.find((u) => u.name === "app");
    expect(app?.instructions).toBe("rule lib\n\nrule app");
    expect(app?.tools).toEqual(["lib.run", "app.run"]);
    expect(app?.dependencies).toEqual(["lib"]);
    const lib = result.units.find((u) => u.name === "lib");
    expect(lib?.dependencies).toEqual([]);
  });
  test("transitive closure lands in dependencies", () => {
    const result = compile([skill("app", ["mid"], ["app.run"]), skill("mid", ["base"], ["mid.run"]), skill("base", [], ["base.run"])]);
    const app = result.units.find((u) => u.name === "app");
    expect(app?.dependencies).toEqual(["base", "mid"]);
  });
  test("cache: same input hits, changed dep key misses", () => {
    const cache = new MemoryCache();
    const skills = [skill("app", ["lib"]), skill("lib", [], ["lib.run"], "1.0.0")];
    const first = compile(skills, { cache });
    expect(first.cacheMisses).toBe(2);
    const second = compile(skills, { cache });
    expect(second.cacheHits).toBe(2);
    expect(second.units).toEqual(first.units);
    const changed = [skill("app", ["lib"]), skill("lib", [], ["lib.run"], "1.1.0")];
    const third = compile(changed, { cache });
    expect(third.cacheMisses).toBe(2);
  });
  test("unit keys depend on dep keys, not just the definition", () => {
    const base1 = [skill("app", ["lib"]), skill("lib", [], ["lib.run"], "1.0.0")];
    const base2 = [skill("app", ["lib"]), skill("lib", [], ["lib.run"], "2.0.0")];
    const key1 = compile(base1).units.find((u) => u.name === "app")?.key;
    const key2 = compile(base2).units.find((u) => u.name === "app")?.key;
    expect(key1).not.toBe(key2);
  });
  test("propagates resolve errors", () => {
    expect(() => compile([skill("app", ["ghost"])]))
      .toThrow(new RegExp("depends on ghost"));
  });
});
