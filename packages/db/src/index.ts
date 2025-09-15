import type { NamespaceServerApplicatorTree } from "@groundswell/core";
import { serverApplicatorTreeFactory } from "@groundswell/core";
import type {
  AuthRepository,
  ClassRepository,
  CourseRepository,
  DomainEvent,
  HolidayRepository,
  SchoolRepository,
  SemesterRepository,
  UnknownDatabaseError,
  YearRepository,
} from "@stu/lib";
import type { Database } from "./database";
import { authApplicators } from "./event-handlers/auth";
import { orgApplicators } from "./event-handlers/org";
import { studentApplicators } from "./event-handlers/student";
import type { PersonRepository } from "./repositories/person.repo";
import type { StudentRepository } from "./repositories/student.repo";
import type { TimetableRepository } from "./repositories/timetable.repo";

const applicatorTree: Partial<
  NamespaceServerApplicatorTree<
    DomainEvent,
    UnknownDatabaseError,
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

export const applicators = serverApplicatorTreeFactory(applicatorTree);
export * from "drizzle-orm";
export { alias } from "drizzle-orm/pg-core";
export * from "./database";
export * from "./repositories";
export * as schema from "./schema";
export * from "./scratchpad";
