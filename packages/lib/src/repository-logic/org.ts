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

type ClassRepositoryWriteAdapter = Pick<ClassRepositoryAdapter<never>, "insertClass" | "insertTeacherLink">;

export type YearClassCreatePayload = {
  startYear: number;
  school: SchoolId;
  classes: {
    identifierInYear: string;
    teachers: string[];
  }[];
};

const createClassCore = (adapter: ClassRepositoryWriteAdapter) =>
  Effect.fn(function* (payload: ClassCreatePayload) {
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

export const createYearClassesCore = (adapter: ClassRepositoryWriteAdapter) => {
  const createClass = createClassCore(adapter);

  return Effect.fn(function* (payload: YearClassCreatePayload) {
    for (const cls of payload.classes) {
      yield* createClass({
        identifier: cls.identifierInYear,
        startYear: payload.startYear,
        school: payload.school,
        teachers: cls.teachers,
      });
    }
  });
};

export const classRepositoryLogic = <TClass>(adapter: ClassRepositoryAdapter<TClass>) => {
  const doesClassExist = Effect.fn(function* (payload: ClassLookupPayload) {
    const clazz = yield* adapter.getClass(payload);
    return clazz !== undefined;
  });

  const createClassCoreLogic = createClassCore(adapter);

  return {
    getClass: adapter.getClass,
    doesClassExist,
    createClassCore: createClassCoreLogic,
  };
};
