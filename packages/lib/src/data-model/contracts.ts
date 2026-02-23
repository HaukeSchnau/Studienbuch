export type CoreSchemaParityTableName =
  | "schools"
  | "years"
  | "classes"
  | "semesters"
  | "persons"
  | "students"
  | "courses"
  | "courses_to_teachers"
  | "courses_to_classes"
  | "tasks"
  | "timetable_entries"
  | "recurring_timetable_entries"
  | "room_changes";

export type StudentDomainSchemaParityTableName = "grades" | "absence_days" | "course_absences";

export interface SchemaParityContract {
  tableName: CoreSchemaParityTableName | StudentDomainSchemaParityTableName;
  requiredColumns: readonly string[];
  primaryKeyColumns: readonly string[];
}

export const SHARED_CORE_TABLE_PARITY_CONTRACTS = [
  {
    tableName: "schools",
    requiredColumns: ["id", "name", "state_code"],
    primaryKeyColumns: ["id"],
  },
  {
    tableName: "years",
    requiredColumns: ["name", "start_year", "graduation_year", "school"],
    primaryKeyColumns: ["start_year", "school"],
  },
  {
    tableName: "classes",
    requiredColumns: ["identifier_in_year", "start_year", "school"],
    primaryKeyColumns: ["identifier_in_year", "start_year", "school"],
  },
  {
    tableName: "semesters",
    requiredColumns: ["name", "start", "end", "school", "type", "year"],
    primaryKeyColumns: ["school", "type", "year"],
  },
  {
    tableName: "persons",
    requiredColumns: ["id", "first_name", "last_name", "salutation", "abbrv", "email"],
    primaryKeyColumns: ["id"],
  },
  {
    tableName: "students",
    requiredColumns: ["person", "is_of_age", "class_identifier", "start_year", "school"],
    primaryKeyColumns: ["person"],
  },
  {
    tableName: "courses",
    requiredColumns: [
      "id",
      "name",
      "subject",
      "school",
      "semester_type",
      "semester_year",
      "is_mandatory",
    ],
    primaryKeyColumns: ["id"],
  },
  {
    tableName: "courses_to_teachers",
    requiredColumns: ["course", "teacher"],
    primaryKeyColumns: ["course", "teacher"],
  },
  {
    tableName: "courses_to_classes",
    requiredColumns: ["course", "school", "class_identifier", "class_start_year"],
    primaryKeyColumns: ["course", "class_identifier", "class_start_year", "school"],
  },
  {
    tableName: "tasks",
    requiredColumns: ["id", "title", "description", "due_date", "course", "assignee", "images", "done"],
    primaryKeyColumns: ["id"],
  },
  {
    tableName: "timetable_entries",
    requiredColumns: ["date", "duration", "course"],
    primaryKeyColumns: ["date", "course"],
  },
  {
    tableName: "recurring_timetable_entries",
    requiredColumns: ["weekday", "start", "duration", "weeks", "room", "course"],
    primaryKeyColumns: ["weekday", "start", "course"],
  },
  {
    tableName: "room_changes",
    requiredColumns: ["date", "course", "room", "createdAt", "updatedAt"],
    primaryKeyColumns: [],
  },
] as const satisfies readonly SchemaParityContract[];

export const POSTGRES_STUDENT_DOMAIN_TABLE_PARITY_CONTRACTS = [
  {
    tableName: "grades",
    requiredColumns: [
      "date",
      "result",
      "type",
      "teacher_signature",
      "parent_signature",
      "course",
      "student",
    ],
    primaryKeyColumns: ["date", "course", "student", "type"],
  },
  {
    tableName: "absence_days",
    requiredColumns: ["date", "student", "reason", "parent_signature"],
    primaryKeyColumns: ["date", "student"],
  },
  {
    tableName: "course_absences",
    requiredColumns: ["date", "student", "course", "teacher_signature"],
    primaryKeyColumns: ["date", "course", "student"],
  },
] as const satisfies readonly SchemaParityContract[];

export const SQLITE_STUDENT_DOMAIN_TABLE_PARITY_CONTRACTS = [
  {
    tableName: "grades",
    requiredColumns: ["date", "result", "type", "teacher_signature", "parent_signature", "course"],
    primaryKeyColumns: ["date", "course", "type"],
  },
  {
    tableName: "absence_days",
    requiredColumns: ["date", "reason", "parent_signature"],
    primaryKeyColumns: ["date"],
  },
  {
    tableName: "course_absences",
    requiredColumns: ["date", "course", "teacher_signature"],
    primaryKeyColumns: ["date", "course"],
  },
] as const satisfies readonly SchemaParityContract[];

export const INTENTIONALLY_DIVERGENT_STUDENT_DOMAIN_TABLES = {
  grades: "SQLite omits student scoping because data is single-profile local state.",
  absence_days: "SQLite omits student scoping because data is single-profile local state.",
  course_absences: "SQLite omits student scoping because data is single-profile local state.",
} as const;

export const INTENTIONALLY_DIVERGENT_SCHEMA_TABLE_ALLOWLIST = {
  holidays: "Primary key shape intentionally differs between PG and SQLite implementations.",
  rooms: "Present only in server DB schema.",
  course_memberships: "Present only in server DB schema; student uses course membership flags.",
  substitutions: "Timetable substitutions are tracked in a separate parity slice.",
  timetable_entry_rooms: "Present only in student SQLite schema.",
} as const;
