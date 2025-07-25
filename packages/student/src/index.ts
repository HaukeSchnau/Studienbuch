import { type ApplicatorError, applicatorTreeFactory, type NamespaceApplicatorTree } from "@groundswell/core";
import type { DatabaseError, GenericSqliteError } from "@schnau/effect-drizzle/generic-sqlite";
import type {
  AbsenceRepository,
  ClassRepository,
  CourseRepository,
  DomainEvent,
  GradeRepository,
  HolidayRepository,
  PersonRepository,
  SchoolRepository,
  SemesterRepository,
  StudentRepository,
  TimetableRepository,
  YearRepository,
} from "@stu/lib";
import { absenceApplicators } from "./event-handlers/absences";
import { gradeApplicators } from "./event-handlers/grades";
import { orgApplicators } from "./event-handlers/org";
import { studentApplicators } from "./event-handlers/student";

const applicatorTree: Partial<
  NamespaceApplicatorTree<
    DomainEvent,
    DatabaseError<GenericSqliteError> | ApplicatorError,
    | StudentRepository
    | AbsenceRepository
    | GradeRepository
    | SchoolRepository
    | PersonRepository
    | YearRepository
    | CourseRepository
    | TimetableRepository
    | HolidayRepository
    | SemesterRepository
    | ClassRepository
  >
> = {
  absence: absenceApplicators,
  grades: gradeApplicators,
  org: orgApplicators,
  student: studentApplicators,
};

export * from "./database";
export const applicators = applicatorTreeFactory(applicatorTree);
export * from "./repositories";
export * from "./schema/utils";
