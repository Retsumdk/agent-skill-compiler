/** Reads the committed demo snapshot; used by the demo-stability test and CI. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");

export function demoExpected(): string {
  return readFileSync(join(ROOT, "demo-output.txt"), "utf8");
}

if (import.meta.main) {
  process.stdout.write(demoExpected());
}
