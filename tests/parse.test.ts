import { describe, expect, test } from "bun:test";
import { parseSkill, parseSkillFile, parseSkillRef } from "../src/parse.js";
import { ParseError } from "../src/errors.js";

const VALID = {
  name: "summarizer",
  version: "1.0.0",
  instructions: "Summarize {{page}}.",
  tools: ["llm.summarize"],
  dependsOn: [],
};

describe("parseSkill", () => {
  test("accepts a valid skill", () => {
    const skill = parseSkill(VALID, "s.json");
    expect(skill.name).toBe("summarizer");
    expect(skill.dependsOn).toEqual([]);
    expect(skill.description).toBeUndefined();
  });
  test("error paths are precise", () => {
    expect(() => parseSkill({ ...VALID, name: "Bad_Name" }, "s.json"))
      .toThrow(/s\.json\.name.*must match/);
    expect(() => parseSkill({ ...VALID, tools: [] }, "s.json"))
      .toThrow(/s\.json\.tools.*non-empty/);
    expect(() => parseSkill({ ...VALID, tools: ["noDot"] }, "s.json"))
      .toThrow(/s\.json\.tools\[0\].*domain\.action/);
    expect(() => parseSkill({ ...VALID, extra: 1 }, "s.json"))
      .toThrow(/unknown field "extra"/);
  });
  test("duplicate tools rejected", () => {
    expect(() => parseSkill({ ...VALID, tools: ["a.b", "a.b"] }, "s.json"))
      .toThrow(/duplicate tool "a\.b"/);
  });
});

describe("parseSkillRef", () => {
  test("splits name@range", () => {
    const ref = parseSkillRef("textutils@^1.2.0", "p");
    expect(ref).toEqual({ name: "textutils", range: "^1.2.0" });
  });
  test("bare name means any version", () => {
    expect(parseSkillRef("textutils", "p")).toEqual({ name: "textutils", range: "*" });
  });
  test("rejects bad names and ranges", () => {
    expect(() => parseSkillRef("9lives@^1.0.0", "p")).toThrow(ParseError);
    expect(() => parseSkillRef("ok@^latest", "p")).toThrow(ParseError);
    expect(() => parseSkillRef(42, "p")).toThrow(ParseError);
  });
});

describe("parseSkillFile", () => {
  test("single object", () => {
    expect(parseSkillFile(JSON.stringify(VALID), "f")).toHaveLength(1);
  });
  test("skills wrapper", () => {
    const wrapped = JSON.stringify({ skills: [VALID, VALID] });
    expect(parseSkillFile(wrapped, "f")).toHaveLength(2);
  });
  test("bare array", () => {
    expect(parseSkillFile(JSON.stringify([VALID]), "f")).toHaveLength(1);
  });
  test("invalid JSON reports path", () => {
    expect(() => parseSkillFile("{nope", "dir/f.json")).toThrow(/dir\/f\.json.*invalid JSON/);
  });
});
