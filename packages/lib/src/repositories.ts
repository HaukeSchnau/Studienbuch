import type { DatabaseError } from "@schnau/effect-drizzle/generic-sqlite";
import { Context, Data, type Effect } from "effect";
import type { SubjectId } from "./courses";
import type { GradeType } from "./grades";
import type { SchoolId, StateCode } from "./schools";
import type { SemesterId, SemesterType } from "./semesters";

type UnknownDatabaseError = DatabaseError<{ message: string }>;

export class AbsenceRepository extends Context.Tag("AbsenceRepository")<
  AbsenceRepository,
  {
    addAbsence: (payload: {
      date: Date;
      reason: string;
      courseIds: string[];
      isSignatureRequired: boolean;
    }) => Effect.Effect<void, UnknownDatabaseError>;

    setParentSignature: (payload: { date: Date; signature: string }) => Effect.Effect<void, UnknownDatabaseError>;

    setTeacherSignature: (payload: {
      date: Date;
      courseId: string;
      signature: string;
    }) => Effect.Effect<void, UnknownDatabaseError>;

    deleteAbsence: (payload: { date: Date; courseIds: string[] }) => Effect.Effect<void, UnknownDatabaseError>;
  }
>() {}

export class CourseRepository extends Context.Tag("CourseRepository")<
  CourseRepository,
  {
    doesCourseExist: (payload: { id: string }) => Effect.Effect<boolean, UnknownDatabaseError>;

    getCourse: (payload: { id: string }) => Effect.Effect<
      | {
          id: string;
          name: string;
          subject: SubjectId;
          school: SchoolId;
          semester: SemesterId;
          isMandatory: boolean;
        }
      | undefined,
      UnknownDatabaseError
    >;

    createCourse: (payload: {
      id: string;
      name: string;
      subject: SubjectId;
      school: SchoolId;
      semester: SemesterId;
      isMandatory: boolean;
      teachers: string[];
      classes: { identifierInYear: string; startYear: number }[];
    }) => Effect.Effect<void, UnknownDatabaseError>;
  }
>() {}

export class GradeTooOldError extends Data.TaggedError("GradeTooOldError")<{
  date: Date;
  type: GradeType;
  courseId: string;
}> {
  override get message() {
    return `Grade too old: ${this.date.toISOString()} for course ${this.courseId} of type ${this.type}`;
  }
}

export class GradeRepository extends Context.Tag("GradeRepository")<
  GradeRepository,
  {
    setCurrentGrade: (payload: {
      courseId: string;
      date: Date;
      result: number;
      type: GradeType;
      isSignatureRequired: boolean;
    }) => Effect.Effect<void, UnknownDatabaseError | GradeTooOldError>;

    recordWrittenGrade: (payload: {
      courseId: string;
      date: Date;
      result: number;
      isSignatureRequired: boolean;
    }) => Effect.Effect<void, UnknownDatabaseError>;

    setTeacherSignature: (payload: {
      course: string;
      date: Date;
      type: GradeType;
      signature: string;
    }) => Effect.Effect<void, UnknownDatabaseError>;

    setParentSignature: (payload: {
      course: string;
      date: Date;
      type: GradeType;
      signature: string;
    }) => Effect.Effect<void, UnknownDatabaseError>;

    restoreLatest: (payload: { course: string; type: GradeType }) => Effect.Effect<void, UnknownDatabaseError>;

    discardGrade: (payload: {
      course: string;
      date: Date;
      type: GradeType;
    }) => Effect.Effect<void, UnknownDatabaseError>;
  }
>() {}

export class HolidayRepository extends Context.Tag("HolidayRepository")<
  HolidayRepository,
  {
    getHoliday: (payload: {
      name: string;
      state: StateCode;
      year: number;
    }) => Effect.Effect<
      { name: string; year: number; start: Date; end: Date; state: StateCode } | undefined,
      UnknownDatabaseError
    >;

    doesHolidayExist: (payload: {
      name: string;
      state: StateCode;
      year: number;
    }) => Effect.Effect<boolean, UnknownDatabaseError>;

    createHoliday: (payload: {
      name: string;
      start: Date;
      end: Date;
      state: StateCode;
      year: number;
    }) => Effect.Effect<void, UnknownDatabaseError>;

    getAllHolidays: () => Effect.Effect<
      { name: string; year: number; start: Date; end: Date; state: StateCode }[],
      UnknownDatabaseError
    >;
  }
>() {}

export class PersonRepository extends Context.Tag("PersonRepository")<
  PersonRepository,
  {
    doesTeacherExist: (payload: { id: string }) => Effect.Effect<boolean, UnknownDatabaseError>;

    createTeacher: (payload: {
      personId: string;
      firstName?: string;
      lastName?: string;
      salutation?: "Herr" | "Frau";
      abbrv: string;
    }) => Effect.Effect<void, UnknownDatabaseError>;
  }
>() {}

export class SchoolRepository extends Context.Tag("SchoolRepository")<
  SchoolRepository,
  {
    doesSchoolExist: (payload: { id: SchoolId }) => Effect.Effect<boolean, UnknownDatabaseError>;

    createSchool: (payload: {
      id: SchoolId;
      name: string;
      state: StateCode;
    }) => Effect.Effect<void, UnknownDatabaseError>;

    getSchoolsByState: (payload: {
      state: StateCode;
    }) => Effect.Effect<{ id: SchoolId; name: string }[], UnknownDatabaseError>;
  }
>() {}

export class SemesterRepository extends Context.Tag("SemesterRepository")<
  SemesterRepository,
  {
    createSemesters: (
      payload: { name: string; start: Date; end: Date; type: SemesterType; year: number; school: SchoolId }[],
    ) => Effect.Effect<void, UnknownDatabaseError>;

    getCurrentSemester: () => Effect.Effect<
      { name: string; start: Date; end: Date; type: SemesterType; year: number; school: SchoolId } | undefined,
      UnknownDatabaseError
    >;
  }
>() {}

export class ClassRepository extends Context.Tag("ClassRepository")<
  ClassRepository,
  {
    doesClassExist: (payload: {
      identifier: string;
      startYear: number;
      school: SchoolId;
    }) => Effect.Effect<boolean, UnknownDatabaseError>;

    createClass: (payload: {
      identifier: string;
      startYear: number;
      school: SchoolId;
      teachers: string[];
    }) => Effect.Effect<void, UnknownDatabaseError>;

    getClass: (payload: {
      identifier: string;
      startYear: number;
      school: SchoolId;
    }) => Effect.Effect<
      { identifierInYear: string; startYear: number; school: SchoolId } | undefined,
      UnknownDatabaseError
    >;
  }
>() {}

export class StudentRepository extends Context.Tag("StudentRepository")<
  StudentRepository,
  {
    createStudent: (payload: {
      studentId: string;
      name: string;
      school: SchoolId;
      class: { identifier: string; startYear: number };
      isOfAge: boolean;
    }) => Effect.Effect<void, UnknownDatabaseError>;

    assignCourse: (payload: { courseId: string }) => Effect.Effect<void, UnknownDatabaseError>;

    getStudent: (payload: {
      studentId: string;
    }) => Effect.Effect<
      | { startYear: number; school: SchoolId; person: string; isOfAge: boolean | null; classIdentifier: string }
      | undefined,
      UnknownDatabaseError
    >;
  }
>() {}

export class TimetableRepository extends Context.Tag("TimetableRepository")<
  TimetableRepository,
  {
    doesTimetableEntryExist: (payload: { start: Date; course: string }) => Effect.Effect<boolean, UnknownDatabaseError>;

    createTimetableEntry: (payload: {
      start: Date;
      duration: number;
      course: string;
      rooms: string[];
    }) => Effect.Effect<void, UnknownDatabaseError>;

    deleteTimetableEntry: (payload: { start: Date; course: string }) => Effect.Effect<void, UnknownDatabaseError>;

    createSubstitution: (payload: {
      start: Date;
      course: string;
      substitute: string | null;
      type: "VERTRETUNG" | "ENTFALL";
    }) => Effect.Effect<void, UnknownDatabaseError>;
  }
>() {}

export class YearRepository extends Context.Tag("YearRepository")<
  YearRepository,
  {
    doesYearExist: (payload: {
      name: string;
      startYear: number;
      graduationYear: number;
      school: SchoolId;
    }) => Effect.Effect<boolean, UnknownDatabaseError>;

    createYear: (payload: {
      name: string;
      startYear: number;
      graduationYear: number;
      school: SchoolId;
      classes: { identifierInYear: string; teachers: string[] }[];
    }) => Effect.Effect<void, UnknownDatabaseError>;
  }
>() {}

export class AuthRepository extends Context.Tag("AuthRepository")<
  AuthRepository,
  {
    getLicenseKey: (payload: { key: string }) => Effect.Effect<
      | {
          key: string;
          createdAt: Date;
          activatedAt: Date | null;
          expiresAt: Date | null;
          isSuperKey: boolean;
          school: SchoolId;
          activatedBy: string | null;
        }
      | undefined,
      UnknownDatabaseError
    >;

    doesLicenseKeyExist: (payload: { key: string }) => Effect.Effect<boolean, UnknownDatabaseError>;

    createLicenseKey: (payload: {
      key: string;
      school: SchoolId;
      expiresAt: Date;
      isSuperKey: boolean;
    }) => Effect.Effect<void, UnknownDatabaseError>;

    verifyUserLicense: (payload: {
      userId: string;
      schoolId: SchoolId;
    }) => Effect.Effect<boolean, UnknownDatabaseError>;

    createUser: (payload: { userId: string }) => Effect.Effect<void, UnknownDatabaseError>;

    activateLicenseKey: (payload: { key: string; userId: string }) => Effect.Effect<void, UnknownDatabaseError>;
  }
>() {}
