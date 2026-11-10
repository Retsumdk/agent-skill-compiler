/** Core data types for skill compilation. */
export interface SkillDefinition {
  name: string;
  version: string;
  description?: string;
  instructions: string;
  tools: string[];
  dependsOn: string[];
}

export interface SkillRef {
  name: string;
  range: string;
}

export interface CompiledUnit {
  name: string;
  version: string;
  instructions: string;
  tools: string[];
  dependencies: string[];
  key: string;
}

export interface PlanStep {
  unit: string;
  tool: string;
}

export interface CompileResult {
  units: CompiledUnit[];
  order: string[];
  cacheHits: number;
  cacheMisses: number;
}

export interface CompilePlan {
  batches: PlanStep[][];
  total: number;
}

export interface ResolvedGraph {
  order: string[];
  byName: Map<string, SkillDefinition>;
}
