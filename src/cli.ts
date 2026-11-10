/** `asc` CLI: compile / plan / cache / demo with stable exit codes. */
import { parseArgs } from "node:util";
import process from "node:process";

import { DiskCache, MemoryCache } from "./cache.js";
import { compile } from "./compiler.js";
import { SkillError } from "./errors.js";
import { plan } from "./planner.js";
import { loadSkills } from "./load.js";
import { runDemo } from "./demo.js";

export const EXIT_OK = 0;
export const EXIT_ERROR = 1;
export const EXIT_USAGE = 2;

function printSummary(source: string, json: boolean, cacheDir?: string): number {
  const cache = cacheDir === undefined ? new MemoryCache() : new DiskCache(cacheDir);
  const skills = loadSkills(source);
  const result = compile(skills, { cache });
  const compilePlan = plan(result.units);
  if (json) {
    console.log(JSON.stringify({
      order: result.order,
      units: result.units,
      plan: compilePlan,
      cache: { ...cache.stats(), hits: result.cacheHits, misses: result.cacheMisses },
    }, null, 2));
    return EXIT_OK;
  }
  console.log(`compiled ${result.units.length} skills from ${source}`);
  for (const unit of result.units) {
    console.log(`  ${unit.name}@${unit.version} [${unit.tools.length} tools, ${unit.dependencies.length} deps]`);
  }
  console.log(`plan: ${compilePlan.batches.length} batches, ${compilePlan.total} invocations`);
  compilePlan.batches.forEach((batch, i) => {
    console.log(`  batch ${i + 1}: ${batch.map((s) => s.tool).join(", ")}`);
  });
  console.log(`cache: ${result.cacheHits} hits, ${result.cacheMisses} misses, ${cache.stats().entries} entries`);
  return EXIT_OK;
}

export function main(argv: string[]): number {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      json: { type: "boolean", default: false },
      cache: { type: "string" },
    },
  });
  const [command, source] = positionals;
  if (command === undefined) {
    console.error("usage: asc compile <dir-or-file> [--cache DIR] [--json] | asc demo");
    return EXIT_USAGE;
  }
  try {
    if (command === "demo") return runDemo() === undefined ? EXIT_ERROR : EXIT_OK;
    if (command === "compile" || command === "plan") {
      if (source === undefined) {
        console.error("error: compile/plan need a source path (a .skill.json file or a skills directory)");
        return EXIT_USAGE;
      }
      return printSummary(source, values.json, values.cache);
    }
    console.error(`error: unknown command ${command} (expected compile, plan, or demo)`);
    return EXIT_USAGE;
  } catch (error) {
    if (error instanceof SkillError) {
      console.error(`error: ${error.message}`);
      return EXIT_ERROR;
    }
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
