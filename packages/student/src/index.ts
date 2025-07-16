import { type ApplicatorError, applicatorTreeFactory, type NamespaceApplicatorTree } from "@groundswell/core";
import type { DatabaseError, GenericSqliteError } from "@schnau/effect-drizzle/generic-sqlite";
import type { DomainEvent } from "@stu/lib";
import type { Database } from "./database";
import { absenceApplicators } from "./event-handlers/absences";
import { gradeApplicators } from "./event-handlers/grades";
import { orgApplicators } from "./event-handlers/org";
import { studentApplicators } from "./event-handlers/student";
import type { AbsenceRepository } from "./repositories/absences.repo";
import type { CourseRepository } from "./repositories/course.repo";
import type { GradeRepository } from "./repositories/grades.repo";
import type { HolidayRepository } from "./repositories/holiday.repo";
import type { PersonRepository } from "./repositories/person.repo";
import type { SchoolRepository } from "./repositories/school.repo";
import type { SemesterRepository } from "./repositories/semester.repo";
import type { StudentRepository } from "./repositories/student.repo";
import type { TimetableRepository } from "./repositories/timetable.repo";
import type { YearRepository } from "./repositories/year.repo";

const applicatorTree: Partial<
  NamespaceApplicatorTree<
    DomainEvent,
    DatabaseError<GenericSqliteError> | ApplicatorError,
    | Database
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
