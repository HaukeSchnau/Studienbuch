import { z } from "zod";

import { authApplicators } from "./event-handlers/auth";
import { orgApplicators } from "./event-handlers/org";
import { studentApplicators } from "./event-handlers/student";
import type { NamespaceApplicatorTree } from "@groundswell/core";
import type { DomainEvent } from "@stu/lib";
import type { DatabaseError } from "@schnau/effect-drizzle/postgres";
import type { Database } from "./database";
import type { AuthRepository } from "./event-handlers/auth.repo";
import type { OrgRepository } from "./event-handlers/org.repo";
import type { StudentRepository } from "./event-handlers/student.repo";

const applicators: Partial<
  NamespaceApplicatorTree<DomainEvent, DatabaseError, Database | AuthRepository | OrgRepository | StudentRepository>
> = {
  auth: authApplicators,
  org: orgApplicators,
  student: studentApplicators,
};

export { applicators };
export * from "./database";
export * from "drizzle-orm";
export * as schema from "./schema";
export * as tables from "./schema";
