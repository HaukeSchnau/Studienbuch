import type { NamespaceServerApplicatorMap } from "@groundswell/core";
import type {
  ClassRepository,
  CourseRepository,
  HolidayRepository,
  SchoolRepository,
  SemesterRepository,
  UnknownDatabaseError,
  YearRepository,
} from "@stu/lib";
import type { Database } from "../../database";
import type { DomainEvent } from "../../domain-event";
import type { PersonRepository } from "../../repositories/person.repo";
import type { TimetableRepository } from "../../repositories/timetable.repo";

export type OrgApplicatorDependencies =
  | Database
  | SchoolRepository
  | PersonRepository
  | YearRepository
  | ClassRepository
  | CourseRepository
  | HolidayRepository
  | TimetableRepository
  | SemesterRepository;

export type OrgApplicatorMap = NamespaceServerApplicatorMap<
  DomainEvent,
  "org",
  UnknownDatabaseError,
  OrgApplicatorDependencies
>;
