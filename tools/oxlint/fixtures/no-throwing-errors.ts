// oxlint-disable-next-line studienbuch/no-throwing-errors -- fixture: an assertion module
import * as NodeAssert from "node:assert";

export const isPositive = (value: number) => NodeAssert.ok(value > 0);

export function fail(): never {
  // oxlint-disable-next-line studienbuch/no-throwing-errors -- fixture: a throw
  throw new Error("failed");
}

// oxlint-disable-next-line studienbuch/no-throwing-errors -- fixture: a rejected promise
export const rejected = () => Promise.reject(new Error("rejected"));

// oxlint-disable-next-line studienbuch/no-throwing-errors -- fixture: an assertion signature
export declare function check(value: number): asserts value is 1;
