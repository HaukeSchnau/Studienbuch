import { Data, Effect } from "effect";

export * from "./absences";
export * from "./auth";
export * from "./classes";
export * from "./courses";
export * from "./data-model/contracts";
export * from "./data-model/parity";
export * from "./events";
export * from "./formalName";
export * from "./grades";
export * from "./infrastructure";
export * from "./org-event-logic";
export * from "./repositories";
export * from "./schedule";
export * from "./school";
export * from "./semesters";
export * from "./snapshot";
export * from "./snapshot/mappers";
export * from "./snapshot-helpers";
export * from "./snapshot-test-fixtures";
export * from "./student";
export * from "./student-event-logic";
export * from "./student-id";
export * from "./teacher";
export * from "./theme";
export * from "./user";
export * from "./year";

export class RequiredEntityNotFoundError extends Data.TaggedError("RequiredEntityNotFoundError")<{
  kind?: string;
  id?: unknown;
}> {
  get message() {
    return `Required entity ${this.kind}: ${this.id} not found`;
  }
}

export const ensureEntityDefined =
  (kind?: string, id?: unknown) =>
  <A>(value: A): Effect.Effect<NonNullable<A>, RequiredEntityNotFoundError> => {
    if (value !== null && value !== undefined) {
      return Effect.succeed(value);
    }

    return Effect.fail(new RequiredEntityNotFoundError({ kind, id }));
  };
