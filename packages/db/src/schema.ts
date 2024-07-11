import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const CourseTimeWeeks = pgEnum("CourseTimeWeeks", [
  "EVEN",
  "ODD",
  "BOTH",
]);
export const GradeType = pgEnum("GradeType", ["WRITTEN", "ORAL", "MASTER"]);

export const PERMISSIONS = [
  "EDIT_INFO_PAGES",
  "EDIT_USERS",
  "EDIT_COURSES",
  "EDIT_YEARS",
  "EDIT_CLASSES",
  "EDIT_SCHOOLS",
  "VIEW_LOGS",
] as const;
export const Permission = pgEnum("Permission", PERMISSIONS);
export const SemesterType = pgEnum("SemesterType", ["SUMMER", "WINTER"]);
export const StateCode = pgEnum("StateCode", [
  "BB",
  "BE",
  "BW",
  "BY",
  "HB",
  "HE",
  "HH",
  "MV",
  "NI",
  "NW",
  "RP",
  "SH",
  "SL",
  "SN",
  "ST",
  "TH",
]);
export const StaticRole = pgEnum("StaticRole", ["TEACHER", "STUDENT"]);
export const SubstitutionType = pgEnum("SubstitutionType", [
  "FREISETZUNG",
  "VERTRETUNG",
  "BETREUUNG",
  "ENTFALL",
  "TROTZ_ABSENZ",
]);

export const Course = pgTable(
  "Course",
  {
    id: serial("id").primaryKey().notNull(),
    courseId: text("courseId").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" })
      .defaultNow()
      .notNull(),
    room: text("room"),
    isChoosable: boolean("isChoosable").default(false).notNull(),
    teacherId: integer("teacherId")
      .notNull()
      .references(() => User.id, { onDelete: "restrict", onUpdate: "cascade" }),
    classId: integer("classId")
      .notNull()
      .references(() => Class.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    updatedAt: timestamp("updatedAt", { precision: 3, mode: "date" })
      .defaultNow()
      .notNull(),
    semesterId: uuid("semesterId").references(() => Semester.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
  },
  (table) => {
    return {
      courseId_semesterId_room_key: uniqueIndex(
        "Course_courseId_semesterId_room_key",
      ).on(table.courseId, table.room, table.semesterId),
    };
  },
);

export const CourseTime = pgTable("CourseTime", {
  id: serial("id").primaryKey().notNull(),
  weekday: integer("weekday").notNull(),
  start: integer("start").notNull(),
  duration: integer("duration").notNull(),
  weeks: CourseTimeWeeks("weeks").default("BOTH").notNull(),
  courseId: integer("courseId").references(() => Course.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  createdAt: timestamp("createdAt", { precision: 3, mode: "date" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updatedAt", { precision: 3, mode: "date" })
    .defaultNow()
    .notNull(),
});

export const Role = pgTable(
  "Role",
  {
    id: serial("id").primaryKey().notNull(),
    name: text("name").notNull(),
    defaultScope: jsonb("defaultScope"),
  },
  (table) => {
    return {
      name_key: uniqueIndex("Role_name_key").on(table.name),
    };
  },
);

export const School = pgTable(
  "School",
  {
    id: serial("id").primaryKey().notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("createdAt", { precision: 3, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updatedAt", { precision: 3, mode: "string" })
      .defaultNow()
      .notNull(),
    image: text("image").notNull(),
    theme: jsonb("theme").notNull(),
    stateCode: StateCode("stateCode").default("NI").notNull(),
  },
  (table) => {
    return {
      name_key: uniqueIndex("School_name_key").on(table.name),
    };
  },
);

export const Session = pgTable("Session", {
  userId: integer("userId").references(() => User.id, {
    onDelete: "cascade",
    onUpdate: "cascade",
  }),
  expires: timestamp("expires", { precision: 3, mode: "date" }).notNull(),
  token: text("token").primaryKey().notNull(),
});

export const Substitution = pgTable(
  "Substitution",
  {
    id: serial("id").primaryKey().notNull(),
    date: timestamp("date", { precision: 3, mode: "date" }).notNull(),
    lessonStart: integer("lessonStart").notNull(),
    lessonEnd: integer("lessonEnd").notNull(),
    createdAt: timestamp("createdAt", { precision: 3, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updatedAt", {
      precision: 3,
      mode: "date",
    }).notNull(),
    courseId: integer("courseId")
      .notNull()
      .references(() => Course.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    room: text("room"),
    type: SubstitutionType("type"),
    substituteId: integer("substituteId").references(() => User.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
  },
  (table) => {
    return {
      date_lessonStart_courseId_key: uniqueIndex(
        "Substitution_date_lessonStart_courseId_key",
      ).on(table.date, table.lessonStart, table.courseId),
    };
  },
);

export const Class = pgTable(
  "Class",
  {
    id: serial("id").primaryKey().notNull(),
    identifierInYear: text("identifierInYear").notNull(),
    createdAt: timestamp("createdAt", { precision: 3, mode: "string" })
      .defaultNow()
      .notNull(),
    yearId: integer("yearId")
      .notNull()
      .references(() => Year.id, { onDelete: "restrict", onUpdate: "cascade" }),
    updatedAt: timestamp("updatedAt", { precision: 3, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      identifierInYear_yearId_key: uniqueIndex(
        "Class_identifierInYear_yearId_key",
      ).on(table.identifierInYear, table.yearId),
    };
  },
);

export const _RoleToUser = pgTable(
  "_RoleToUser",
  {
    role: integer("A")
      .notNull()
      .references(() => Role.id, { onDelete: "cascade", onUpdate: "cascade" }),
    user: integer("B")
      .notNull()
      .references(() => User.id, { onDelete: "cascade", onUpdate: "cascade" }),
  },
  (table) => {
    return {
      AB_unique: uniqueIndex("_RoleToUser_AB_unique").on(
        table.role,
        table.user,
      ),
      B_idx: index().on(table.user),
    };
  },
);

export const Year = pgTable(
  "Year",
  {
    id: serial("id").primaryKey().notNull(),
    startYear: integer("startYear").notNull(),
    graduationYear: integer("graduationYear").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("createdAt", { precision: 3, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updatedAt", { precision: 3, mode: "string" })
      .defaultNow()
      .notNull(),
    schoolId: integer("schoolId")
      .notNull()
      .references(() => School.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
  },
  (table) => {
    return {
      startYear_schoolId_key: uniqueIndex("Year_startYear_schoolId_key").on(
        table.startYear,
        table.schoolId,
      ),
    };
  },
);

export const CourseSubscription = pgTable(
  "CourseSubscription",
  {
    id: serial("id").primaryKey().notNull(),
    createdAt: timestamp("createdAt", { precision: 3, mode: "string" })
      .defaultNow()
      .notNull(),
    courseId: integer("courseId")
      .notNull()
      .references(() => Course.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    messagingToken: text("messagingToken").notNull(),
  },
  (table) => {
    return {
      courseId_messagingToken_key: uniqueIndex(
        "CourseSubscription_courseId_messagingToken_key",
      ).on(table.courseId, table.messagingToken),
    };
  },
);

export const User = pgTable(
  "User",
  {
    id: serial("id").primaryKey().notNull(),
    email: text("email"),
    name: text("name").notNull(),
    title: text("title"),
    abbrv: text("abbrv"),
    createdAt: timestamp("createdAt", { precision: 3, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updatedAt", {
      precision: 3,
      mode: "date",
    }).notNull(),
    passwordHash: text("passwordHash"),
    isSuperUser: boolean("isSuperUser").default(false).notNull(),
    role: StaticRole("role"),
    notificationKey: text("notificationKey"),
  },
  (table) => {
    return {
      abbrv_key: uniqueIndex("User_abbrv_key").on(table.abbrv),
    };
  },
);

export const Semester = pgTable(
  "Semester",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    name: text("name").notNull(),
    start: timestamp("start", { precision: 3, mode: "date" }).notNull(),
    end: timestamp("end", { precision: 3, mode: "date" }).notNull(),
    schoolId: integer("schoolId")
      .notNull()
      .references(() => School.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    type: SemesterType("type").notNull(),
    year: integer("year").notNull(),
  },
  (table) => {
    return {
      year_type_schoolId_key: uniqueIndex("Semester_year_type_schoolId_key").on(
        table.schoolId,
        table.type,
        table.year,
      ),
    };
  },
);

export const LicenseKey = pgTable(
  "LicenseKey",
  {
    id: serial("id").primaryKey().notNull(),
    key: text("key").notNull(),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" })
      .defaultNow()
      .notNull(),
    activatedAt: timestamp("activatedAt", { precision: 3, mode: "date" }),
    expiresAt: timestamp("expiresAt", { precision: 3, mode: "date" }),
    isSuperKey: boolean("isSuperKey").default(false).notNull(),
    activatedById: integer("activatedById").references(() => User.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
  },
  (table) => {
    return {
      key_key: uniqueIndex("LicenseKey_key_key").on(table.key),
    };
  },
);

export const _students = pgTable(
  "_students",
  {
    A: integer("A")
      .notNull()
      .references(() => Course.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    B: integer("B")
      .notNull()
      .references(() => User.id, { onDelete: "cascade", onUpdate: "cascade" }),
  },
  (table) => {
    return {
      AB_unique: uniqueIndex("_students_AB_unique").on(table.A, table.B),
      B_idx: index().on(table.B),
    };
  },
);

export const Absence = pgTable("Absence", {
  id: text("id").primaryKey().notNull(),
  date: timestamp("date", { precision: 3, mode: "string" }).notNull(),
  reason: text("reason").notNull(),
  courseId: integer("courseId")
    .notNull()
    .references(() => Course.id, { onDelete: "restrict", onUpdate: "cascade" }),
  studentId: integer("studentId")
    .notNull()
    .references(() => User.id, { onDelete: "restrict", onUpdate: "cascade" }),
  teacherSignature: text("teacherSignature"),
  parentSignature: text("parentSignature"),
});

export const Grade = pgTable("Grade", {
  id: text("id").primaryKey().notNull(),
  date: timestamp("date", { precision: 3, mode: "string" }).notNull(),
  result: numeric("result", { precision: 65, scale: 30 }).notNull(),
  type: GradeType("type").notNull(),
  teacherSignature: text("teacherSignature"),
  parentSignature: text("parentSignature"),
  courseId: integer("courseId")
    .notNull()
    .references(() => Course.id, { onDelete: "restrict", onUpdate: "cascade" }),
  studentId: integer("studentId")
    .notNull()
    .references(() => User.id, { onDelete: "restrict", onUpdate: "cascade" }),
});

export const Task = pgTable("Task", {
  id: text("id").primaryKey().notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  dueDate: timestamp("dueDate", { precision: 3, mode: "string" }).notNull(),
  courseId: integer("courseId")
    .notNull()
    .references(() => Course.id, { onDelete: "restrict", onUpdate: "cascade" }),
  ownerId: integer("ownerId")
    .notNull()
    .references(() => User.id, { onDelete: "restrict", onUpdate: "cascade" }),
  images: text("images").array(),
  done: boolean("done").default(false).notNull(),
});

export const _ClassToCourse = pgTable(
  "_ClassToCourse",
  {
    class: integer("A")
      .notNull()
      .references(() => Class.id, { onDelete: "cascade", onUpdate: "cascade" }),
    course: integer("B")
      .notNull()
      .references(() => Course.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
  },
  (table) => {
    return {
      AB_unique: uniqueIndex("_ClassToCourse_AB_unique").on(
        table.class,
        table.course,
      ),
      B_idx: index().on(table.course),
    };
  },
);

export const PermissionOnUser = pgTable(
  "PermissionOnUser",
  {
    permission: Permission("permission").notNull(),
    userId: integer("userId")
      .notNull()
      .references(() => User.id, { onDelete: "restrict", onUpdate: "cascade" }),
    scope: jsonb("scope"),
  },
  (table) => {
    return {
      PermissionOnUser_pkey: primaryKey({
        columns: [table.permission, table.userId],
        name: "PermissionOnUser_pkey",
      }),
    };
  },
);

export const PermissionOnRole = pgTable(
  "PermissionOnRole",
  {
    permission: Permission("permission").notNull(),
    roleId: integer("roleId")
      .notNull()
      .references(() => Role.id, { onDelete: "restrict", onUpdate: "cascade" }),
    scope: jsonb("scope"),
  },
  (table) => {
    return {
      PermissionOnRole_pkey: primaryKey({
        columns: [table.permission, table.roleId],
        name: "PermissionOnRole_pkey",
      }),
    };
  },
);
