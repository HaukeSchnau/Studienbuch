export * from "./absences";
export * from "./auth";
export * from "./classes";
export * from "./courses";
export * from "./dates";
export * from "./events";
export * from "./grades";
export * from "./infrastructure";
export * from "./result";
export * from "./schedule";
export * from "./schools";
export * from "./semesters";
export * from "./substitutions";
export * from "./theme";
export * from "./users";
export * from "./years";

import { Effect } from "effect";

export const debugLog = (tag: string) => Effect.tap((value) => Effect.log(tag, value));
