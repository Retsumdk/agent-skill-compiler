/** Load skill definitions from a file or a directory of *.skill.json files. */
import { readFileSync, statSync } from "node:fs";

import { ParseError } from "./errors.js";
import { loadSkillDirectory, parseSkillFile } from "./parse.js";
import type { SkillDefinition } from "./types.js";

/** A skill set may not carry the same name twice, at any version. */
function rejectDuplicateNames(skills: SkillDefinition[]): SkillDefinition[] {
  const seen = new Map<string, string>();
  for (const skill of skills) {
    const existing = seen.get(skill.name);
    if (existing !== undefined) {
      throw new ParseError(
        `duplicate skill name "${skill.name}" (${existing} and ${skill.version} in the same set)`,
      );
    }
    seen.set(skill.name, skill.version);
  }
  return skills;
}

/**
 * `source` is either a directory (every *.skill.json inside, sorted) or a
 * single file holding one skill, {"skills": [...]}, or a bare array.
 */
export function loadSkills(source: string): SkillDefinition[] {
  let stats;
  try {
    stats = statSync(source);
  } catch (error) {
    throw new ParseError(
      `cannot read skill directory ${source}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (stats.isDirectory()) return loadSkillDirectory(source).skills;
  return rejectDuplicateNames(parseSkillFile(readFileSync(source, "utf8"), source));
}

export function loadSkillsFromString(text: string, path: string): SkillDefinition[] {
  return rejectDuplicateNames(parseSkillFile(text, path));
}
