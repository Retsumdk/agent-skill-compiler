/** Deterministic demo: scripted skills, memory cache, byte-identical output. */
import { compile } from "./compiler.js";
import { MemoryCache } from "./cache.js";
import { plan } from "./planner.js";
import type { SkillDefinition } from "./types.js";

const SKILLS: SkillDefinition[] = [
  {
    name: "textutils",
    version: "1.2.0",
    instructions: "Normalize whitespace before any text analysis.",
    tools: ["text.normalize"],
    dependsOn: [],
  },
  {
    name: "web-fetch",
    version: "0.4.1",
    instructions: "Fetch the URL in {{url}} and return the page text.",
    tools: ["web.fetch", "text.normalize"],
    dependsOn: ["textutils@^1.0.0"],
  },
  {
    name: "summarizer",
    version: "2.0.0",
    instructions: "Summarize {{page}} in five bullet points.",
    tools: ["llm.summarize"],
    dependsOn: ["web-fetch@~0.4.0", "textutils@^1.2.0"],
  },
];

export function runDemo(): string {
  const lines: string[] = ["agent-skill-compiler demo", "========================", ""];
  const cache = new MemoryCache();
  const first = compile(SKILLS, { cache });
  lines.push(`resolved order: ${first.order.join(" -> ")}`);
  for (const unit of first.units) {
    lines.push(`unit ${unit.name}@${unit.version} (key ${unit.key.slice(0, 12)})`);
    lines.push(`  tools: ${unit.tools.join(", ")}`);
    lines.push(`  deps: ${unit.dependencies.length === 0 ? "(none)" : unit.dependencies.join(", ")}`);
  }
  const compiled = first.units.find((u) => u.name === "summarizer");
  if (compiled !== undefined) {
    lines.push("");
    lines.push("summarizer instructions:");
    for (const section of compiled.instructions.split("\n\n")) lines.push(`  - ${section}`);
  }
  const compiledPlan = plan(first.units);
  lines.push("");
  lines.push(`execution plan: ${compiledPlan.batches.length} batches, ${compiledPlan.total} steps`);
  compiledPlan.batches.forEach((batch, i) => {
    lines.push(`  batch ${i + 1}: ${batch.map((s) => s.tool).join(", ")}`);
  });
  lines.push("");
  lines.push(`cache after first compile: ${JSON.stringify(cache.stats())}`);
  const second = compile(SKILLS, { cache });
  lines.push(`second compile: cacheHits=${second.cacheHits} cacheMisses=${second.cacheMisses}`);
  return lines.join("\n");
}

if (import.meta.main) console.log(runDemo());
