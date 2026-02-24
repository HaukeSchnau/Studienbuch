import { Effect } from "effect";
import type { SimpleDate } from "../infrastructure/dates";
import { dateToSimpleDate } from "../infrastructure/dates";
import type { UnknownDatabaseError } from "../repositories";
import type { SchoolId } from "../school";
import type { Semester } from "../semesters";
import type { SubjectId } from "../courses";
import type { Year } from "../year";

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

type SemesterDateColumns = {
  start: Date;
  end: Date;
};

type SemesterWithSimpleDate<TSemester extends SemesterDateColumns> = Omit<TSemester, "start" | "end"> & {
  start: SimpleDate;
  end: SimpleDate;
};

type SemesterRepositoryAdapter<TSemester extends SemesterDateColumns> = {
  getSemesterOnDate: (date: Date, school: SchoolId) => Effect.Effect<TSemester | undefined, UnknownDatabaseError>;
  getNextSemesterAfterDate: (date: Date, school: SchoolId) => Effect.Effect<TSemester | undefined, UnknownDatabaseError>;
  getLatestSemester: (school: SchoolId) => Effect.Effect<TSemester | undefined, UnknownDatabaseError>;
  semestersInYear: (year: Year) => Effect.Effect<TSemester[], UnknownDatabaseError>;
};

const toSemesterWithSimpleDate = <TSemester extends SemesterDateColumns>(
  semester: TSemester,
): SemesterWithSimpleDate<TSemester> => ({
  ...semester,
  start: dateToSimpleDate(semester.start),
  end: dateToSimpleDate(semester.end),
});

export const semesterRepositoryLogic = <TSemester extends SemesterDateColumns>(adapter: SemesterRepositoryAdapter<TSemester>) => {
  const getSemesterOnDate = Effect.fn(function* (date: Date, school: SchoolId) {
    const semester = yield* adapter.getSemesterOnDate(date, school);
    if (!semester) return undefined;
    return toSemesterWithSimpleDate(semester);
  });

  const getNextSemesterAfterDate = Effect.fn(function* (date: Date, school: SchoolId) {
    const semester = yield* adapter.getNextSemesterAfterDate(date, school);
    if (!semester) return undefined;
    return toSemesterWithSimpleDate(semester);
  });

  const getLatestSemester = Effect.fn(function* (school: SchoolId) {
    const semester = yield* adapter.getLatestSemester(school);
    if (!semester) return undefined;
    return toSemesterWithSimpleDate(semester);
  });

  const semestersInYear = Effect.fn(function* (year: Year) {
    const semesters = yield* adapter.semestersInYear(year);
    return semesters.map(toSemesterWithSimpleDate);
  });

  return {
    getSemesterOnDate,
    getNextSemesterAfterDate,
    getLatestSemester,
    semestersInYear,
  };
};
