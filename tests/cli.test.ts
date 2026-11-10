import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main, EXIT_OK, EXIT_ERROR, EXIT_USAGE } from "../src/cli.js";
import { runDemo } from "../src/demo.js";
import { demoExpected } from "../scripts/verify-demo.js";

function skillsFile(dir: string, body: string): string {
  const file = join(dir, "skills.json");
  writeFileSync(file, body);
  return file;
}

const TWO = JSON.stringify({
  skills: [
    { name: "lib", version: "1.0.0", instructions: "rule lib", tools: ["lib.run"], dependsOn: [] },
    { name: "app", version: "1.0.0", instructions: "rule app", tools: ["app.run"], dependsOn: ["lib@^1.0.0"] },
  ],
});

describe("asc main()", () => {
  test("compile prints summary, exit 0", () => {
    const dir = mkdtempSync(join(tmpdir(), "asc-cli-"));
    const captured: string[] = [];
    const original = console.log;
    console.log = (line: string) => captured.push(line);
    const code = main(["compile", skillsFile(dir, TWO)]);
    console.log = original;
    expect(code).toBe(EXIT_OK);
    expect(captured.join("\n")).toContain("compiled 2 skills");
    expect(captured.join("\n")).toContain("batch 1: lib.run");
    expect(captured.join("\n")).toContain("batch 2: app.run");
  });
  test("--json emits machine-readable output", () => {
    const dir = mkdtempSync(join(tmpdir(), "asc-cli-"));
    const captured: string[] = [];
    const original = console.log;
    console.log = (line: string) => captured.push(line);
    main(["compile", skillsFile(dir, TWO), "--json"]);
    console.log = original;
    const parsed = JSON.parse(captured.join("\n"));
    expect(parsed.order).toEqual(["lib", "app"]);
    expect(parsed.plan.total).toBe(2);
  });
  test("usage errors exit 2", () => {
    expect(main([])).toBe(EXIT_USAGE);
    expect(main(["frobnicate"])).toBe(EXIT_USAGE);
  });
  test("compile without a source exits 2", () => {
    expect(main(["compile"])).toBe(EXIT_USAGE);
  });
  test("bad skill exits 1 with message", () => {
    const dir = mkdtempSync(join(tmpdir(), "asc-cli-"));
    expect(() => main(["compile", skillsFile(dir, "{oops")])).not.toThrow();
  });
  test("error exit code is 1 for skill errors", () => {
    const dir = mkdtempSync(join(tmpdir(), "asc-cli-"));
    const captured: string[] = [];
    const originalErr = console.error;
    console.error = (line: string) => captured.push(line);
    const code = main(["compile", join(dir, "nope.json")]);
    console.error = originalErr;
    expect(code).toBe(EXIT_ERROR);
    expect(captured.join("\n")).toMatch(/error: .*(cannot read|no \*\.skill\.json)/);
  });
});

describe("demo stability", () => {
  test("byte-identical to the committed snapshot", () => {
    expect(runDemo() + "\n").toBe(demoExpected());
  });
});
