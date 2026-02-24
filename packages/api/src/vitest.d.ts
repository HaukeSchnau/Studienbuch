import "vitest";

interface CustomMatchers<R = unknown> {
  toBeOk: () => R;
}

declare module "vitest" {
  // oxlint-disable-next-line @typescripttypescript/no-empty-object-type
  interface Assertion<T = unknown> extends CustomMatchers<T> {}
  // oxlint-disable-next-line @typescripttypescript/no-empty-object-type
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
