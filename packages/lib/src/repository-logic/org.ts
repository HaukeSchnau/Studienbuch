import { Effect } from "effect";
import type { SubjectId } from "../courses";
import type { UnknownDatabaseError } from "../repositories";
import type { SchoolId } from "../school";
import type { Semester } from "../semesters";

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

export type CourseLookupPayload = {
  id: string;
};

export type CourseCreatePayload = {
  id: string;
  name: string;
  subject: SubjectId;
  school: SchoolId;
  semester: Semester.Id;
  isMandatory: boolean;
  teachers: string[];
  classes: {
    identifierInYear: string;
    startYear: number;
  }[];
};

type CourseSemesterColumns = {
  semesterType: Semester.Type;
  semesterYear: number;
};

type CourseRepositoryAdapter<TCourse extends CourseSemesterColumns> = {
  getCourse: (payload: CourseLookupPayload) => Effect.Effect<TCourse | undefined, UnknownDatabaseError>;
  insertCourse: (payload: {
    id: string;
    name: string;
    subject: SubjectId;
    school: SchoolId;
    semesterType: Semester.Type;
    semesterYear: number;
    isMandatory: boolean;
  }) => Effect.Effect<void, UnknownDatabaseError>;
  insertTeacherLink: (payload: {
    course: string;
    teacher: string;
  }) => Effect.Effect<void, UnknownDatabaseError>;
  insertClassLink: (payload: {
    course: string;
    school: SchoolId;
    classIdentifier: string;
    classStartYear: number;
  }) => Effect.Effect<void, UnknownDatabaseError>;
};

type CourseRepositoryWriteAdapter = Pick<CourseRepositoryAdapter<CourseSemesterColumns>, "insertCourse" | "insertTeacherLink" | "insertClassLink">;

type CourseWithSemester<TCourse extends CourseSemesterColumns> = Omit<TCourse, "semesterType" | "semesterYear"> & {
  semester: {
    type: TCourse["semesterType"];
    year: TCourse["semesterYear"];
  };
};

const toCourseWithSemester = <TCourse extends CourseSemesterColumns>(course: TCourse): CourseWithSemester<TCourse> => {
  const { semesterType, semesterYear, ...rest } = course;
  return {
    ...rest,
    semester: {
      type: semesterType,
      year: semesterYear,
    },
  } as CourseWithSemester<TCourse>;
};

const createCourseCore = (adapter: CourseRepositoryWriteAdapter) =>
  Effect.fn(function* (payload: CourseCreatePayload) {
    yield* adapter.insertCourse({
      id: payload.id,
      name: payload.name,
      subject: payload.subject,
      school: payload.school,
      semesterType: payload.semester.type,
      semesterYear: payload.semester.year,
      isMandatory: payload.isMandatory,
    });
    for (const teacher of payload.teachers) {
      yield* adapter.insertTeacherLink({
        course: payload.id,
        teacher,
      });
    }
    for (const clazz of payload.classes) {
      yield* adapter.insertClassLink({
        course: payload.id,
        school: payload.school,
        classIdentifier: clazz.identifierInYear,
        classStartYear: clazz.startYear,
      });
    }
  });

export const courseRepositoryLogic = <TCourse extends CourseSemesterColumns>(adapter: CourseRepositoryAdapter<TCourse>) => {
  const getCourse = Effect.fn(function* (payload: CourseLookupPayload) {
    const course = yield* adapter.getCourse(payload);
    if (!course) return undefined;
    return toCourseWithSemester(course);
  });

  const doesCourseExist = Effect.fn(function* (payload: CourseLookupPayload) {
    const course = yield* getCourse(payload);
    return course !== undefined;
  });

  const createCourseCoreLogic = createCourseCore(adapter);

  return {
    getCourse,
    doesCourseExist,
    createCourseCore: createCourseCoreLogic,
  };
};
