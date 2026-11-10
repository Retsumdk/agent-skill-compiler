/** Minimal ambient surface for `bun:test` used by this repo's test suite. */
declare module "bun:test" {
  interface ExpectStatic {
    (received: unknown): Assertion;
  }
  interface Assertion {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toMatch(expected: string | RegExp): void;
    toContain(expected: unknown): void;
    toBeDefined(): void;
    toBeUndefined(): void;
    toBeGreaterThan(expected: number): void;
    toBeGreaterThanOrEqual(expected: number): void;
    toBeLessThan(expected: number): void;
    toBeLessThanOrEqual(expected: number): void;
    toBeNaN(): void;
    toBeFinite(): void;
    toBeNull(): void;
    toHaveLength(expected: number): void;
    toThrow(expected?: string | RegExp | (new (...args: never[]) => Error)): void;
    not: Assertion;
  }
  const expect: ExpectStatic;
  export function test(name: string, fn: () => void | Promise<void>): void;
  export function it(name: string, fn: () => void | Promise<void>): void;
  export function describe(name: string, fn: () => void): void;
  export function beforeAll(fn: () => void | Promise<void>): void;
  export function afterAll(fn: () => void | Promise<void>): void;
  export function beforeEach(fn: () => void | Promise<void>): void;
  export function afterEach(fn: () => void | Promise<void>): void;
}
