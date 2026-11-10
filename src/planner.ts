/** Execution planning: deduped tool invocations batched per unit. */
import type { CompilePlan, CompiledUnit } from "./types.js";

export function plan(units: CompiledUnit[]): CompilePlan {
  const batches: CompilePlan["batches"] = [];
  const seen = new Set<string>();
  for (const unit of units) {
    const batch = unit.tools
      .filter((tool) => !seen.has(tool))
      .map((tool) => ({ unit: unit.name, tool }));
    for (const step of batch) seen.add(step.tool);
    if (batch.length > 0) batches.push(batch);
  }
  return { batches, total: batches.reduce((sum, b) => sum + b.length, 0) };
}
