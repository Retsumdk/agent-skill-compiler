/** Dependency-graph resolution: topo order, cycle detection, version checks. */
import { CycleError, MissingDependencyError, VersionConflictError } from "./errors.js";
import { satisfies } from "./semver.js";
import type { ResolvedGraph, SkillDefinition } from "./types.js";

function parseRefName(ref: string): string {
  const at = ref.indexOf("@");
  return at === -1 ? ref : ref.slice(0, at);
}

function parseRefRange(ref: string): string {
  const at = ref.indexOf("@");
  return at === -1 ? "*" : ref.slice(at + 1);
}

/** Resolve the graph over `skills`: deterministic topo order, deps first. */
export function resolveGraph(skills: SkillDefinition[]): ResolvedGraph {
  const byName = new Map<string, SkillDefinition>();
  for (const skill of skills) {
    const existing = byName.get(skill.name);
    if (existing !== undefined && existing.version !== skill.version) {
      throw new VersionConflictError(
        `two versions of ${skill.name} in the same set: ${existing.version} and ${skill.version}`);
    }
    byName.set(skill.name, skill);
  }
  for (const skill of skills) {
    for (const ref of skill.dependsOn) {
      const dep = byName.get(parseRefName(ref));
      if (dep === undefined) {
        throw new MissingDependencyError(
          `${skill.name}@${skill.version} depends on ${parseRefName(ref)}, which is not in the skill set`);
      }
      const range = parseRefRange(ref);
      if (!satisfies(dep.version, range)) {
        throw new VersionConflictError(
          `${skill.name}@${skill.version} requires ${parseRefName(ref)} ${range}, but ${dep.version} is present`);
      }
    }
  }

  const state = new Map<string, "visiting" | "done">();
  const order: string[] = [];
  const visit = (name: string, stack: string[]): void => {
    const marker = state.get(name);
    if (marker === "done") return;
    if (marker === "visiting") {
      const start = stack.indexOf(name);
      throw new CycleError([...stack.slice(start), name]);
    }
    state.set(name, "visiting");
    const skill = byName.get(name);
    if (skill === undefined) {
      throw new MissingDependencyError(`internal: ${name} missing from set`);
    }
    const deps = skill.dependsOn.map(parseRefName).sort();
    for (const dep of deps) visit(dep, [...stack, name]);
    state.set(name, "done");
    order.push(name);
  };
  for (const name of [...byName.keys()].sort()) visit(name, []);
  return { order, byName };
}

/** Extract the dependency name from a ref like "name@^1.0.0". */
export function refName(ref: string): string {
  return parseRefName(ref);
}
