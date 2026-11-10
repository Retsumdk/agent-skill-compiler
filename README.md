# agent-skill-compiler

Compiles agent skill definitions: resolves their dependency graph, caches compiled
units by content, and turns the dependency-ordered units into batched execution plans.

## The problem

Agent skills rarely stand alone. A "summarize this page" skill depends on a
fetch skill, which depends on text normalization — and every framework that
loads skills re-does the same fragile work by hand: concatenating instruction
text, unioning tool lists, guessing an execution order, and re-deriving all of
it from source every single start. When a dependency changes, downstream skills
must recompile; when it does not, recompiling is wasted work and a source of
drift.

## How this solves it

`agent-skill-compiler` treats a skill set as a dependency graph and a build
system:

1. **Parse and validate** — skill definitions (JSON) are checked with precise
   error paths (`s.json.name: 'name' must match ...`), not `undefined` crashes.
2. **Resolve** — the graph is validated (missing deps, version-range conflicts,
   cycles are reported with the exact cycle path) and flattened into a
   deterministic dependency-first order.
3. **Compile** — each skill becomes a `CompiledUnit`: merged instructions in
   dependency order (deduplicated by section), the union of tools, and the
   transitive dependency closure.
4. **Cache** — units are content-addressed: a unit's key is
   `sha256(canonical(definition) + dep-keys)`, so editing a dependency
   invalidates only the units below it in the graph. Cache hits are exact.
5. **Plan** — tools are emitted as batches (one batch per unit, dependency
   order, deduplicated across units) — a ready-to-schedule execution plan.

Zero runtime dependencies. Strict TypeScript. Deterministic output.

## Installation

```bash
git clone https://github.com/Retsumdk/agent-skill-compiler.git
cd agent-skill-compiler
bun install
```

Install as a library from GitHub (built via the `prepare` script):

```bash
npm install github:Retsumdk/agent-skill-compiler
```

## Usage

### CLI

```bash
# compile a directory of *.skill.json files (or a single file)
bun src/cli.ts compile examples/
bun src/cli.ts compile examples/ --cache .cache   # disk-backed cache
bun src/cli.ts compile examples/ --json           # machine-readable

# just the execution plan
bun src/cli.ts plan examples/

# deterministic offline demo
bun src/cli.ts demo
```

Exit codes: `0` ok · `1` error (parse/resolve failure, message on stderr) · `2` usage.

### Library

```ts
import { compile, plan, MemoryCache } from "agent-skill-compiler";

const skills = [
  {
    name: "textutils",
    version: "1.2.0",
    instructions: "Normalize whitespace before any text analysis.",
    tools: ["text.normalize"],
    dependsOn: [],
  },
  {
    name: "summarizer",
    version: "2.0.0",
    instructions: "Summarize {{page}} in five bullet points.",
    tools: ["llm.summarize"],
    dependsOn: ["textutils@^1.2.0"],
  },
];

const result = compile(skills, { cache: new MemoryCache() });
result.order;                       // ["textutils", "summarizer"]
result.units[1].tools;              // ["text.normalize", "llm.summarize"]
result.cacheMisses;                 // 2 on a cold cache
const { batches, total } = plan(result.units);
```

### Skill definition format

```json
{
  "name": "summarizer",
  "version": "2.0.0",
  "description": "Optional human-readable summary",
  "instructions": "Summarize {{page}} in five bullet points.",
  "tools": ["llm.summarize"],
  "dependsOn": ["textutils@^1.2.0", "web-fetch@~0.4.0"]
}
```

- `name` — `[a-z][a-z0-9-]*`
- `version` — `x.y.z`
- `instructions` — non-empty; sections are merged dependency-first
- `tools` — non-empty, each matching `domain.action`, no duplicates
- `dependsOn` — refs `name` or `name@range`; ranges: `^x.y.z`, `~x.y.z`,
  exact `x.y.z`, or `*`

A file may hold one skill, `{"skills": [...]}`, or a bare array. A directory
source loads every `*.skill.json` (sorted) and rejects duplicate names.

## Examples

The committed demo (run `bun src/cli.ts demo`) is byte-stable and exercised in
CI. Excerpt:

```
resolved order: textutils -> web-fetch -> summarizer
unit textutils@1.2.0 (key 6f2a75c52949)
  tools: text.normalize
  deps: (none)
...
execution plan: 3 batches, 4 steps
  batch 1: text.normalize
  batch 2: web.fetch
  batch 3: llm.summarize
```

The second compile against a warm cache reports `cacheHits=3 cacheMisses=0`.

## Development

```bash
bun install
bun test                 # 51 tests across 8 files
bun run typecheck        # strict tsc over src
bun run typecheck:tests  # strict tsc over src + tests
bun src/cli.ts demo | diff demo-output.txt -   # demo byte-stability
```

CI runs all of the above on every push, plus a Node 22 job that installs the
package from GitHub and imports it end-to-end.

## License

MIT — see [LICENSE](LICENSE).
