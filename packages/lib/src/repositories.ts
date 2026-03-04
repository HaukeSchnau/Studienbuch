import { Data, ServiceMap, type Effect } from "effect";
import type { SubjectId } from "./courses";
import type { GradeType } from "./grades";
import type { SimpleDate } from "./infrastructure/dates";
import type { SchoolId, StateCode } from "./school";
import type { Semester } from "./semesters";
import type { StudentId } from "./student-id";

export interface UnknownDatabaseError {
  readonly _tag: "DatabaseError";
  readonly type: "unique_violation" | "foreign_key_violation" | "connection_error" | "unknown";
  readonly cause: {
    readonly message: string;
  };
  readonly drizzleError: unknown;
  readonly message: string;
}

export class AbsenceRepository extends ServiceMap.Service<
  AbsenceRepository,
  {
    addAbsence: (payload: {
      studentId: StudentId;
      date: Date;
      reason: string;
      courseIds: string[];
      isSignatureRequired: boolean;
    }) => Effect.Effect<void, UnknownDatabaseError>;

    setParentSignature: (payload: {
      studentId: StudentId;
      date: Date;
      signature: string;
    }) => Effect.Effect<void, UnknownDatabaseError>;

    setTeacherSignature: (payload: {
      studentId: StudentId;
      date: Date;
      courseId: string;
      signature: string;
    }) => Effect.Effect<void, UnknownDatabaseError>;

    deleteAbsence: (payload: {
      studentId: StudentId;
      date: Date;
      courseIds: string[];
    }) => Effect.Effect<void, UnknownDatabaseError>;
  }
>()("AbsenceRepository") {}

export class CourseRepository extends ServiceMap.Service<
  CourseRepository,
  {
    doesCourseExist: (payload: { id: string }) => Effect.Effect<boolean, UnknownDatabaseError>;

    getCourse: (payload: { id: string }) => Effect.Effect<
      | {
          id: string;
          name: string;
          subject: SubjectId;
          school: SchoolId;
          semester: Semester.Id;
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
      semester: Semester.Id;
      isMandatory: boolean;
      teachers: string[];
      classes: { identifierInYear: string; startYear: number }[];
    }) => Effect.Effect<void, UnknownDatabaseError>;
  }
>()("CourseRepository") {}

export class GradeTooOldError extends Data.TaggedError("GradeTooOldError")<{
  date: Date;
  type: GradeType;
  courseId: string;
}> {
  override get message() {
    return `Grade too old: ${this.date.toISOString()} for course ${this.courseId} of type ${this.type}`;
  }
}

export class GradeRepository extends ServiceMap.Service<
  GradeRepository,
  {
    setCurrentGrade: (payload: {
      studentId: StudentId;
      courseId: string;
      date: Date;
      result: number;
      type: GradeType;
      isSignatureRequired: boolean;
    }) => Effect.Effect<void, UnknownDatabaseError | GradeTooOldError>;

    recordWrittenGrade: (payload: {
      studentId: StudentId;
      courseId: string;
      date: Date;
      result: number;
      isSignatureRequired: boolean;
    }) => Effect.Effect<void, UnknownDatabaseError>;

    setTeacherSignature: (payload: {
      studentId: StudentId;
      course: string;
      date: Date;
      type: GradeType;
      signature: string;
    }) => Effect.Effect<void, UnknownDatabaseError>;

    setParentSignature: (payload: {
      studentId: StudentId;
      course: string;
      date: Date;
      type: GradeType;
      signature: string;
    }) => Effect.Effect<void, UnknownDatabaseError>;

    restoreLatest: (payload: {
      studentId: StudentId;
      course: string;
      type: GradeType;
    }) => Effect.Effect<void, UnknownDatabaseError>;

    discardGrade: (payload: {
      studentId: StudentId;
      course: string;
      date: Date;
      type: GradeType;
    }) => Effect.Effect<void, UnknownDatabaseError>;
  }
>()("GradeRepository") {}

export class HolidayRepository extends ServiceMap.Service<
  HolidayRepository,
  {
    getHoliday: (payload: {
      name: string;
      state: StateCode;
      year: number;
    }) => Effect.Effect<
      { name: string; year: number; start: SimpleDate; end: SimpleDate; state: StateCode } | undefined,
      UnknownDatabaseError
    >;

    doesHolidayExist: (payload: {
      name: string;
      state: StateCode;
      year: number;
    }) => Effect.Effect<boolean, UnknownDatabaseError>;

    createHoliday: (payload: {
      name: string;
      start: SimpleDate;
      end: SimpleDate;
      state: StateCode;
      year: number;
    }) => Effect.Effect<void, UnknownDatabaseError>;

    getAllHolidays: () => Effect.Effect<
      { name: string; year: number; start: SimpleDate; end: SimpleDate; state: StateCode }[],
      UnknownDatabaseError
    >;
  }
>()("HolidayRepository") {}

export class PersonRepository extends ServiceMap.Service<
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
>()("PersonRepository") {}

export class SchoolRepository extends ServiceMap.Service<
  SchoolRepository,
  {
    doesSchoolExist: (payload: { id: SchoolId }) => Effect.Effect<boolean, UnknownDatabaseError>;

    getSchool: (payload: { id: SchoolId }) => Effect.Effect<
      | {
          id: SchoolId;
          name: string;
          stateCode: StateCode;
        }
      | undefined,
      UnknownDatabaseError
    >;

    createSchool: (payload: {
      id: SchoolId;
      name: string;
      state: StateCode;
    }) => Effect.Effect<void, UnknownDatabaseError>;

    getSchoolsByState: (payload: {
      state: StateCode;
    }) => Effect.Effect<{ id: SchoolId; name: string }[], UnknownDatabaseError>;
  }
>()("SchoolRepository") {}

export class ClassRepository extends ServiceMap.Service<
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
>()("ClassRepository") {}

export class TimetableRepository extends ServiceMap.Service<
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
>()("TimetableRepository") {}

export class AuthRepository extends ServiceMap.Service<
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

    getAllUsers: () => Effect.Effect<{ id: string }[], UnknownDatabaseError>;
  }
>()("AuthRepository") {}
