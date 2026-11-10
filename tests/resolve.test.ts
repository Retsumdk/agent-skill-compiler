import { describe, expect, test } from "bun:test";
import { refName, resolveGraph } from "../src/resolve.js";
import { CycleError, MissingDependencyError, VersionConflictError } from "../src/errors.js";
import type { SkillDefinition } from "../src/types.js";

function skill(name: string, dependsOn: string[], version = "1.0.0"): SkillDefinition {
  return { name, version, instructions: `do ${name}`, tools: [`${name.replace(/-/g, "")}.run`], dependsOn };
}

describe("resolveGraph", () => {
  test("deps come first, order deterministic", () => {
    const graph = resolveGraph([skill("app", ["b@^1.0.0", "a@*"]), skill("b", []), skill("a", [])]);
    expect(graph.order).toEqual(["a", "b", "app"]);
  });
  test("missing dependency", () => {
    expect(() => resolveGraph([skill("app", ["ghost@^1.0.0"])]))
      .toThrow(new RegExp("depends on ghost, which is not in the skill set"));
    expect(() => resolveGraph([skill("app", ["ghost"])])) .toThrow(MissingDependencyError);
  });
  test("cycle reports the cycle path", () => {
    expect(() => resolveGraph([skill("a", ["b"]), skill("b", ["c"]), skill("c", ["a"])]))
      .toThrow(CycleError);
    try {
      resolveGraph([skill("a", ["b"]), skill("b", ["a"])]);
    } catch (error) {
      expect((error as CycleError).cycle).toEqual(["a", "b", "a"]);
    }
  });
  test("version conflict when range unsatisfied", () => {
    const skills = [skill("app", ["lib@^2.0.0"]), skill("lib", [], "1.5.0")];
    expect(() => resolveGraph(skills))
      .toThrow(new RegExp("requires lib \\^2\\.0\\.0, but 1\\.5\\.0 is present"));
    expect(() => resolveGraph(skills)).toThrow(VersionConflictError);
  });
  test("duplicate name with different versions conflicts", () => {
    expect(() => resolveGraph([skill("x", [], "1.0.0"), skill("x", [], "1.1.0")])).toThrow(VersionConflictError);
  });
  test("satisfied ranges pass", () => {
    const graph = resolveGraph([skill("app", ["lib@~1.0.0"]), skill("lib", [], "1.0.7")]);
    expect(graph.order).toEqual(["lib", "app"]);
  });
});

describe("refName", () => {
  test("strips range", () => {
    expect(refName("web-fetch@~0.4.0")).toBe("web-fetch");
    expect(refName("web-fetch")).toBe("web-fetch");
  });
});
