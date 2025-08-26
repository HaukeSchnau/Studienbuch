import { Effect } from "effect";

export * from "./array";
export * from "./dates";
export * from "./errors";
export * from "./map";
export * from "./strings";

export type Falsy = null | undefined | 0 | "" | false;

export const isNotNullish = <T>(value: T): value is NonNullable<T> => {
  return value !== null && value !== undefined;
};

export const debugLog = (tag: string) => Effect.tap((value) => Effect.log(tag, value));
