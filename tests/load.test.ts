import { describe, expect, test } from "bun:test";

import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";

import { tmpdir } from "node:os";

import { join } from "node:path";

import { loadSkills, loadSkillsFromString } from "../src/load.js";

import { ParseError } from "../src/errors.js";




const SKILL = JSON.stringify({

  name: "a", version: "1.0.0", instructions: "do a", tools: ["a.run"], dependsOn: [],

});
const SKILLB = JSON.stringify({ name: "b", version: "1.0.0", instructions: "do a", tools: ["a.run"], dependsOn: [] });



describe("loadSkillsFromString", () => {

  test("single object, skills wrapper, and bare array", () => {

    expect(loadSkillsFromString(SKILL, "f")).toHaveLength(1);

    expect(loadSkillsFromString(`{"skills": [${SKILL}, ${SKILLB}]}`, "f")).toHaveLength(2);

    expect(loadSkillsFromString(`[${SKILL}]`, "f")).toHaveLength(1);

  });

  test("duplicate names across files are rejected", () => {

    expect(() => loadSkillsFromString(`[${SKILL}, ${SKILL}]`, "f")).toThrow(/duplicate skill name "a"/);

  });

});



describe("loadSkills", () => {

  test("reads a single file", () => {

    const dir = mkdtempSync(join(tmpdir(), "asc-src-"));

    const file = join(dir, "a.skill.json");

    writeFileSync(file, SKILL);

    expect(loadSkills(file)).toHaveLength(1);

  });

  test("reads a directory of *.skill.json files sorted", () => {

    const dir = mkdtempSync(join(tmpdir(), "asc-src-"));

    writeFileSync(join(dir, "b.skill.json"), SKILL.replace('"a"', '"b"'));

    writeFileSync(join(dir, "a.skill.json"), SKILL);

    const skills = loadSkills(dir);

    expect(skills.map((s) => s.name)).toEqual(["a", "b"]);

  });

  test("ignores non-skill files in a directory", () => {

    const dir = mkdtempSync(join(tmpdir(), "asc-src-"));

    writeFileSync(join(dir, "a.skill.json"), SKILL);

    writeFileSync(join(dir, "readme.md"), "not a skill");

    expect(loadSkills(dir)).toHaveLength(1);

  });

  test("empty directory and missing paths report precisely", () => {

    const dir = mkdtempSync(join(tmpdir(), "asc-src-"));

    expect(() => loadSkills(dir)).toThrow(new RegExp(`no \\*\\.skill\\.json files in ${dir.replaceAll("/", "\\/")}`));

    expect(() => loadSkills(join(dir, "missing.skill.json"))).toThrow(ParseError);

    expect(() => loadSkills(join(dir, "missing-dir"))).toThrow(/cannot read skill directory/);

  });

  test("nested directory input is rejected with a clear error", () => {

    const dir = mkdtempSync(join(tmpdir(), "asc-src-"));

    mkdirSync(join(dir, "nested"));

    expect(() => loadSkills(join(dir, "nested"))).toThrow(/no \*\.skill\.json/);

  });

});
