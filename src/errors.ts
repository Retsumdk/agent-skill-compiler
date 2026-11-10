export class SkillError extends Error {
  readonly path?: string | undefined;

  constructor(message: string, path?: string) {
    super(path === undefined ? message : `${path}: ${message}`);
    this.name = new.target.name;
    this.path = path;
  }
}

export class ParseError extends SkillError {}
export class ValidationError extends SkillError {}
export class CycleError extends SkillError {
  readonly cycle: string[];
  constructor(cycle: string[]) {
    super(`dependency cycle: ${cycle.join(" -> ")}`);
    this.name = "CycleError";
    this.cycle = cycle;
  }
}
export class MissingDependencyError extends SkillError {}
export class VersionConflictError extends SkillError {}
