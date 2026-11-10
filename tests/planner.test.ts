import { describe, expect, test } from "bun:test";
import { plan } from "../src/planner.js";
import { compile } from "../src/compiler.js";
import type { SkillDefinition } from "../src/types.js";

function skill(name: string, tools: string[], dependsOn: string[] = []): SkillDefinition {
  return { name, version: "1.0.0", instructions: `rule ${name}`, tools, dependsOn };
}

describe("plan", () => {
  test("one batch per unit in dependency order, tools deduped", () => {
    const result = compile([
      skill("summarizer", ["llm.summarize"], ["web-fetch", "textutils"]),
      skill("web-fetch", ["web.fetch", "text.normalize"], ["textutils"]),
      skill("textutils", ["text.normalize"]),
    ]);
    const compiled = plan(result.units);
    expect(compiled.batches.map((b) => b[0]?.unit)).toEqual(["textutils", "web-fetch", "summarizer"]);
    expect(compiled.total).toBe(3);
    expect(compiled.batches[1]?.map((s) => s.tool)).toEqual(["web.fetch"]);
  });
  test("empty units produce no batches", () => {
    const compiled = plan([]);
    expect(compiled).toEqual({ batches: [], total: 0 });
  });
});
