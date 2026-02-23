import { Effect } from "effect";
import type { UnknownDatabaseError } from "../repositories";
import type { SchoolId } from "../school";

export type ClassLookupPayload = {
  identifier: string;
  startYear: number;
  school: SchoolId;
};

export type ClassTeacherLinkPayload = ClassLookupPayload & {
  teacher: string;
};

export type ClassCreatePayload = ClassLookupPayload & {
  teachers: string[];
};

type ClassRepositoryAdapter<TClass> = {
  getClass: (payload: ClassLookupPayload) => Effect.Effect<TClass | undefined, UnknownDatabaseError>;
  insertClass: (payload: ClassLookupPayload) => Effect.Effect<void, UnknownDatabaseError>;
  insertTeacherLink: (payload: ClassTeacherLinkPayload) => Effect.Effect<void, UnknownDatabaseError>;
};

export const classRepositoryLogic = <TClass>(adapter: ClassRepositoryAdapter<TClass>) => {
  const doesClassExist = Effect.fn(function* (payload: ClassLookupPayload) {
    const clazz = yield* adapter.getClass(payload);
    return clazz !== undefined;
  });

  const createClassCore = Effect.fn(function* (payload: ClassCreatePayload) {
    yield* adapter.insertClass(payload);
    for (const teacher of payload.teachers) {
      yield* adapter.insertTeacherLink({
        identifier: payload.identifier,
        startYear: payload.startYear,
        school: payload.school,
        teacher,
      });
    }
  });

  return {
    getClass: adapter.getClass,
    doesClassExist,
    createClassCore,
  };
};
