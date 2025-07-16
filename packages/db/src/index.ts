import type { NamespaceServerApplicatorTree } from "@groundswell/core";
import { serverApplicatorTreeFactory } from "@groundswell/core";
import type { DatabaseError } from "@schnau/effect-drizzle/postgres";
import type { DomainEvent } from "@stu/lib";
import type { Database } from "./database";
import { authApplicators } from "./event-handlers/auth";
import { orgApplicators } from "./event-handlers/org";
import { studentApplicators } from "./event-handlers/student";
import type { AuthRepository } from "./repositories/auth.repo";
import type { ClassRepository } from "./repositories/class.repo";
import type { CourseRepository } from "./repositories/course.repo";
import type { HolidayRepository } from "./repositories/holiday.repo";
import type { PersonRepository } from "./repositories/person.repo";
import type { SchoolRepository } from "./repositories/school.repo";
import type { SemesterRepository } from "./repositories/semester.repo";
import type { StudentRepository } from "./repositories/student.repo";
import type { TimetableRepository } from "./repositories/timetable.repo";
import type { YearRepository } from "./repositories/year.repo";

const applicatorTree: Partial<
  NamespaceServerApplicatorTree<
    DomainEvent,
    DatabaseError,
    | Database
    | AuthRepository
    | SchoolRepository
    | PersonRepository
    | YearRepository
    | ClassRepository
    | CourseRepository
    | HolidayRepository
    | TimetableRepository
    | SemesterRepository
    | StudentRepository
  >
> = {
  auth: authApplicators,
  org: orgApplicators,
  student: studentApplicators,
};

// TODO: see if we can get rid of this types
export const applicators: ReturnType<
  typeof serverApplicatorTreeFactory<
    DomainEvent,
    DatabaseError,
    | Database
    | AuthRepository
    | SchoolRepository
    | PersonRepository
    | YearRepository
    | ClassRepository
    | CourseRepository
    | HolidayRepository
    | TimetableRepository
    | SemesterRepository
    | StudentRepository
  >
> = serverApplicatorTreeFactory(applicatorTree);
export * from "drizzle-orm";
export { alias } from "drizzle-orm/pg-core";
export * from "./database";
export * from "./repositories";
export * as schema from "./schema";
export * as tables from "./schema";
