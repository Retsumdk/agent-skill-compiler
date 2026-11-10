/** Compile skill definitions into cached, dependency-ordered units. */
import { MemoryCache, unitKey, type UnitCache } from "./cache.js";
import { refName, resolveGraph } from "./resolve.js";
import type { CompiledUnit, CompileResult, SkillDefinition } from "./types.js";

export interface CompileOptions {
  cache?: UnitCache;
}

function mergeUnit(skill: SkillDefinition, deps: CompiledUnit[]): CompiledUnit {
  const instructions: string[] = [];
  const seenInstructions = new Set<string>();
  for (const dep of deps) {
    for (const section of dep.instructions.split("\n\n")) {
      if (!seenInstructions.has(section)) {
        seenInstructions.add(section);
        instructions.push(section);
      }
    }
  }
  instructions.push(skill.instructions);
  const tools: string[] = [];
  const seenTools = new Set<string>();
  for (const unit of [...deps, undefined]) {
    for (const tool of unit === undefined ? skill.tools : unit.tools) {
      if (!seenTools.has(tool)) {
        seenTools.add(tool);
        tools.push(tool);
      }
    }
  }
  const dependencies = [...new Set(deps.flatMap((d) => [...d.dependencies, d.name]))].sort();
  return { name: skill.name, version: skill.version, instructions: instructions.join("\n\n"), tools, dependencies, key: "" };
}

export function compile(skills: SkillDefinition[], options: CompileOptions = {}): CompileResult {
  const cache = options.cache ?? new MemoryCache();
  const { order, byName } = resolveGraph(skills);
  const units = new Map<string, CompiledUnit>();
  const keys = new Map<string, string>();
  let cacheHits = 0;
  let cacheMisses = 0;
  for (const name of order) {
    const skill = byName.get(name);
    if (skill === undefined) throw new Error(`internal: ${name} missing after resolve`);
    const depNames = skill.dependsOn.map(refName);
    const depUnits = depNames.map((dep) => units.get(dep)).filter((u): u is CompiledUnit => u !== undefined);
    const depKeys = depNames.map((dep) => keys.get(dep) ?? "");
    const key = unitKey(skill, depKeys);
    keys.set(name, key);
    const cached = cache.get(key);
    if (cached !== undefined) {
      cacheHits += 1;
      units.set(name, cached);
      continue;
    }
    cacheMisses += 1;
    const unit = mergeUnit(skill, depUnits);
    unit.key = key;
    cache.put(unit);
    units.set(name, unit);
  }
  const ordered = order.map((name) => units.get(name) as CompiledUnit);
  return { units: ordered, order, cacheHits, cacheMisses };
}
