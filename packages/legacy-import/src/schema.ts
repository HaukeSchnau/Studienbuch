import {
  pgTable,
  varchar,
  timestamp,
  text,
  integer,
  uniqueIndex,
  foreignKey,
  serial,
  index,
  boolean,
  jsonb,
  primaryKey,
  pgEnum,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const courseTimeWeeks = pgEnum("CourseTimeWeeks", ["EVEN", "ODD", "BOTH"]);
export const permission = pgEnum("Permission", [
  "EDIT_INFO_PAGES",
  "EDIT_USERS",
  "EDIT_COURSES",
  "EDIT_YEARS",
  "EDIT_CLASSES",
  "EDIT_SCHOOLS",
  "VIEW_LOGS",
]);
export const substitutionType = pgEnum("SubstitutionType", [
  "FREISETZUNG",
  "VERTRETUNG",
  "BETREUUNG",
  "ENTFALL",
  "TROTZ_ABSENZ",
]);

export const prismaMigrations = pgTable("_prisma_migrations", {
  id: varchar({ length: 36 }).primaryKey().notNull(),
  checksum: varchar({ length: 64 }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true, mode: "string" }),
  migrationName: varchar("migration_name", { length: 255 }).notNull(),
  logs: text(),
  rolledBackAt: timestamp("rolled_back_at", {
    withTimezone: true,
    mode: "string",
  }),
  startedAt: timestamp("started_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  appliedStepsCount: integer("applied_steps_count").default(0).notNull(),
});

export const year = pgTable(
  "Year",
  {
    id: serial().primaryKey().notNull(),
    startYear: integer().notNull(),
    graduationYear: integer().notNull(),
    name: text().notNull(),
    createdAt: timestamp({ precision: 3, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: timestamp({ precision: 3, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    schoolId: integer().notNull(),
  },
  (table) => [
    uniqueIndex("Year_startYear_schoolId_key").using(
      "btree",
      table.startYear.asc().nullsLast().op("int4_ops"),
      table.schoolId.asc().nullsLast().op("int4_ops"),
    ),
    foreignKey({
      columns: [table.schoolId],
      foreignColumns: [school.id],
      name: "Year_schoolId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
  ],
);

export const courseSubscription = pgTable(
  "CourseSubscription",
  {
    id: serial().primaryKey().notNull(),
    createdAt: timestamp({ precision: 3, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    courseId: integer().notNull(),
    messagingToken: text().notNull(),
  },
  (table) => [
    uniqueIndex("CourseSubscription_courseId_messagingToken_key").using(
      "btree",
      table.courseId.asc().nullsLast().op("int4_ops"),
      table.messagingToken.asc().nullsLast().op("int4_ops"),
    ),
    foreignKey({
      columns: [table.courseId],
      foreignColumns: [course.id],
      name: "CourseSubscription_courseId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
  ],
);

export const school = pgTable(
  "School",
  {
    id: serial().primaryKey().notNull(),
    name: text().notNull(),
    createdAt: timestamp({ precision: 3, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: timestamp({ precision: 3, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => [uniqueIndex("School_name_key").using("btree", table.name.asc().nullsLast().op("text_ops"))],
);

export const roleToUser = pgTable(
  "_RoleToUser",
  {
    a: integer("A").notNull(),
    b: integer("B").notNull(),
  },
  (table) => [
    uniqueIndex("_RoleToUser_AB_unique").using(
      "btree",
      table.a.asc().nullsLast().op("int4_ops"),
      table.b.asc().nullsLast().op("int4_ops"),
    ),
    index().using("btree", table.b.asc().nullsLast().op("int4_ops")),
    foreignKey({
      columns: [table.a],
      foreignColumns: [role.id],
      name: "_RoleToUser_A_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.b],
      foreignColumns: [user.id],
      name: "_RoleToUser_B_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ],
);

export const course = pgTable(
  "Course",
  {
    id: serial().primaryKey().notNull(),
    courseId: text().notNull(),
    name: text().notNull(),
    createdAt: timestamp({ precision: 3, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    room: text(),
    isChoosable: boolean().default(false).notNull(),
    teacherId: integer().notNull(),
    classId: integer().notNull(),
    yearId: integer().notNull(),
    updatedAt: timestamp({ precision: 3, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => [
    uniqueIndex("Course_courseId_classId_yearId_key").using(
      "btree",
      table.courseId.asc().nullsLast().op("text_ops"),
      table.classId.asc().nullsLast().op("int4_ops"),
      table.yearId.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.classId],
      foreignColumns: [clazz.id],
      name: "Course_classId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
    foreignKey({
      columns: [table.teacherId],
      foreignColumns: [user.id],
      name: "Course_teacherId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
    foreignKey({
      columns: [table.yearId],
      foreignColumns: [year.id],
      name: "Course_yearId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
  ],
);

export const courseTime = pgTable(
  "CourseTime",
  {
    id: serial().primaryKey().notNull(),
    weekday: integer().notNull(),
    start: integer().notNull(),
    duration: integer().notNull(),
    weeks: courseTimeWeeks().default("BOTH").notNull(),
    courseId: integer(),
    createdAt: timestamp({ precision: 3, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: timestamp({ precision: 3, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.courseId],
      foreignColumns: [course.id],
      name: "CourseTime_courseId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
  ],
);

export const role = pgTable(
  "Role",
  {
    id: serial().primaryKey().notNull(),
    name: text().notNull(),
    defaultScope: jsonb(),
  },
  (table) => [uniqueIndex("Role_name_key").using("btree", table.name.asc().nullsLast().op("text_ops"))],
);

export const licenseKey = pgTable(
  "LicenseKey",
  {
    id: serial().primaryKey().notNull(),
    key: text().notNull(),
    createdAt: timestamp({ precision: 3, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    activatedAt: timestamp({ precision: 3, mode: "string" }),
    expiresAt: timestamp({ precision: 3, mode: "string" }),
    isSuperKey: boolean().default(false).notNull(),
  },
  (table) => [uniqueIndex("LicenseKey_key_key").using("btree", table.key.asc().nullsLast().op("text_ops"))],
);

export const clazz = pgTable(
  "Class",
  {
    id: serial().primaryKey().notNull(),
    identifierInYear: text().notNull(),
    createdAt: timestamp({ precision: 3, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    yearId: integer().notNull(),
    updatedAt: timestamp({ precision: 3, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => [
    uniqueIndex("Class_identifierInYear_yearId_key").using(
      "btree",
      table.identifierInYear.asc().nullsLast().op("int4_ops"),
      table.yearId.asc().nullsLast().op("int4_ops"),
    ),
    foreignKey({
      columns: [table.yearId],
      foreignColumns: [year.id],
      name: "Class_yearId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
  ],
);

export const session = pgTable(
  "Session",
  {
    userId: integer(),
    expires: timestamp({ precision: 3, mode: "string" }).notNull(),
    token: text().primaryKey().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "Session_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ],
);

export const user = pgTable(
  "User",
  {
    id: serial().primaryKey().notNull(),
    email: text(),
    name: text().notNull(),
    title: text(),
    abbrv: text(),
    createdAt: timestamp({ precision: 3, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: timestamp({ precision: 3, mode: "string" }).notNull(),
    emailVerified: timestamp({ precision: 3, mode: "string" }),
    image: text(),
    passwordHash: text(),
    isSuperUser: boolean().default(false).notNull(),
    role: text().default("TEACHER").notNull(),
  },
  (table) => [uniqueIndex("User_abbrv_key").using("btree", table.abbrv.asc().nullsLast().op("text_ops"))],
);

export const substitution = pgTable(
  "Substitution",
  {
    id: serial().primaryKey().notNull(),
    date: timestamp({ precision: 3, mode: "string" }).notNull(),
    lessonStart: integer().notNull(),
    lessonEnd: integer().notNull(),
    createdAt: timestamp({ precision: 3, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: timestamp({ precision: 3, mode: "string" }).notNull(),
    courseId: integer().notNull(),
    room: text(),
    type: substitutionType(),
    substituteId: integer(),
  },
  (table) => [
    uniqueIndex("Substitution_date_lessonStart_courseId_key").using(
      "btree",
      table.date.asc().nullsLast().op("timestamp_ops"),
      table.lessonStart.asc().nullsLast().op("int4_ops"),
      table.courseId.asc().nullsLast().op("timestamp_ops"),
    ),
    foreignKey({
      columns: [table.courseId],
      foreignColumns: [course.id],
      name: "Substitution_courseId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
    foreignKey({
      columns: [table.substituteId],
      foreignColumns: [user.id],
      name: "Substitution_substituteId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
  ],
);

export const permissionOnUser = pgTable(
  "PermissionOnUser",
  {
    permission: permission().notNull(),
    userId: integer().notNull(),
    scope: jsonb(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "PermissionOnUser_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
    primaryKey({
      columns: [table.permission, table.userId],
      name: "PermissionOnUser_pkey",
    }),
  ],
);

export const permissionOnRole = pgTable(
  "PermissionOnRole",
  {
    permission: permission().notNull(),
    roleId: integer().notNull(),
    scope: jsonb(),
  },
  (table) => [
    foreignKey({
      columns: [table.roleId],
      foreignColumns: [role.id],
      name: "PermissionOnRole_roleId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
    primaryKey({
      columns: [table.permission, table.roleId],
      name: "PermissionOnRole_pkey",
    }),
  ],
);
