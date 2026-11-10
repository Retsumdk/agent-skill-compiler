/** Skill-definition parsing with precise error paths. */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { ParseError } from "./errors.js";
import { isWellFormedRange } from "./semver.js";
import type { SkillDefinition, SkillRef } from "./types.js";

const NAME = /^[a-z][a-z0-9-]*$/;
const TOOL = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)+$/;

function typeLabel(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

export function parseSkillRef(raw: unknown, path: string): SkillRef {
  if (typeof raw !== "string") {
    throw new ParseError(`dependency must be a string, got ${typeLabel(raw)}`, path);
  }
  const at = raw.indexOf("@");
  const name = at === -1 ? raw : raw.slice(0, at);
  const range = at === -1 ? "*" : raw.slice(at + 1);
  if (!NAME.test(name)) {
    throw new ParseError(`dependency name ${JSON.stringify(name)} must match ${NAME}`, path);
  }
  if (!isWellFormedRange(range)) {
    throw new ParseError(`dependency range ${JSON.stringify(range)} is not ^x.y.z, ~x.y.z, x.y.z, or *`, path);
  }
  return { name, range };
}

export function parseSkill(raw: unknown, path: string): SkillDefinition {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ParseError(`skill must be a JSON object, got ${typeLabel(raw)}`, path);
  }
  const record = raw as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!(["name", "version", "description", "instructions", "tools", "dependsOn"] as string[]).includes(key)) {
      throw new ParseError(`unknown field ${JSON.stringify(key)} (expected name, version, description, instructions, tools, dependsOn)`, path);
    }
  }
  const name = record.name;
  if (typeof name !== "string" || !NAME.test(name)) {
    throw new ParseError(`'name' must match ${NAME}, got ${JSON.stringify(name)}`, `${path}.name`);
  }
  const version = record.version;
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new ParseError(`'version' must be x.y.z, got ${JSON.stringify(version)}`, `${path}.version`);
  }
  const instructions = record.instructions;
  if (typeof instructions !== "string" || instructions.trim() === "") {
    throw new ParseError(`'instructions' must be a non-empty string, got ${typeLabel(instructions)}`, `${path}.instructions`);
  }
  const tools = record.tools;
  if (!Array.isArray(tools) || tools.length === 0) {
    throw new ParseError(`'tools' must be a non-empty array of tool names`, `${path}.tools`);
  }
  const toolList: string[] = [];
  const seen = new Set<string>();
  for (const [i, tool] of tools.entries()) {
    if (typeof tool !== "string" || !TOOL.test(tool)) {
      throw new ParseError(`tools[${i}] ${JSON.stringify(tool)} must look like 'domain.action'`, `${path}.tools[${i}]`);
    }
    if (seen.has(tool)) {
      throw new ParseError(`duplicate tool ${JSON.stringify(tool)}`, `${path}.tools[${i}]`);
    }
    seen.add(tool);
    toolList.push(tool);
  }
  const dependsOnRaw = record.dependsOn ?? [];
  if (!Array.isArray(dependsOnRaw)) {
    throw new ParseError(`'dependsOn' must be an array of refs`, `${path}.dependsOn`);
  }
  const dependsOn: string[] = dependsOnRaw.map((ref, i) => {
    parseSkillRef(ref, `${path}.dependsOn[${i}]`);
    return ref as string;
  });
  const definition: SkillDefinition = {
    name,
    version,
    instructions,
    tools: toolList,
    dependsOn,
  };
  if (record.description !== undefined) {
    if (typeof record.description !== "string") {
      throw new ParseError(`'description' must be a string, got ${typeLabel(record.description)}`, `${path}.description`);
    }
    definition.description = record.description;
  }
  return definition;
}

/** Parse a file holding one skill, {"skills": [...]}, or a bare array. */
export function parseSkillFile(text: string, path: string): SkillDefinition[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new ParseError(`invalid JSON: ${error instanceof Error ? error.message : String(error)}`, path);
  }
  if (Array.isArray(data)) return data.map((item, i) => parseSkill(item, `${path}[${i}]`));
  if (data !== null && typeof data === "object" && Array.isArray((data as { skills?: unknown }).skills)) {
    return ((data as { skills: unknown[] }).skills).map((item, i) => parseSkill(item, `${path}.skills[${i}]`));
  }
  return [parseSkill(data, path)];
}

export function loadSkillDirectory(dir: string): { skills: SkillDefinition[] } {
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".skill.json")).sort();
  } catch (error) {
    throw new ParseError(`cannot read skill directory ${dir}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (files.length === 0) {
    throw new ParseError(`no *.skill.json files in ${dir}`);
  }
  const skills: SkillDefinition[] = [];
  for (const file of files) {
    const path = join(dir, file);
    skills.push(...parseSkillFile(readFileSync(path, "utf8"), path));
  }
  return { skills };
}
