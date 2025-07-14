import { absenceApplicators } from "./event-handlers/absences";
import { gradeApplicators } from "./event-handlers/grades";
import { orgApplicators } from "./event-handlers/org";
import { studentApplicators } from "./event-handlers/student";
import { applicatorTreeFactory, type NamespaceApplicatorTree } from "@groundswell/core";
import type { DomainEvent, StudentRepository } from "@stu/lib";
import type { DatabaseError, GenericSqliteError } from "@schnau/effect-drizzle/generic-sqlite";
import type { Database } from "./database";
import type { AbsenceRepository } from "./event-handlers/absences.repo";
import type { GradeRepository } from "./event-handlers/grades.repo";
import type { OrgRepository } from "./event-handlers/org.repo";
import type { StudentRepository as StudentRepo } from "./event-handlers/student.repo";

const applicatorTree: Partial<
  NamespaceApplicatorTree<
    DomainEvent,
    DatabaseError<GenericSqliteError>,
    Database | StudentRepository | StudentRepo | AbsenceRepository | GradeRepository | OrgRepository // TODO: Merge StudentRepo and StudentRepository
  >
> = {
  absence: absenceApplicators,
  grades: gradeApplicators,
  org: orgApplicators,
  student: studentApplicators,
};

export * from "./database";
export const applicators = applicatorTreeFactory(applicatorTree);
